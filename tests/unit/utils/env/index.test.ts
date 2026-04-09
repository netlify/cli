import { expect, test } from 'vitest'
import shuffle from 'lodash.shuffle'

import {
  filterEnvBySource,
  getValueForContext,
  formatEnvelopeData,
  getHumanReadableScopes,
  normalizeContext,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
  type EnvelopeEnvVarValue,
  type EnvelopeItem,
} from '../../../../src/utils/env/index.js'

test('should return a matching value from a given context', () => {
  const values: EnvelopeEnvVarValue[] = shuffle([
    {
      context: 'production',
      value: 'foo',
    },
    {
      context: 'dev',
      value: 'bar',
    },
    {
      context: 'dev-server',
      value: 'bar',
    },
  ])
  expect(getValueForContext(values, 'production')).toHaveProperty('value', 'foo')
  expect(getValueForContext(values, 'dev')).toHaveProperty('value', 'bar')
  expect(getValueForContext(values, 'dev-server')).toHaveProperty('value', 'bar')
})

test('should return a value from the `branch` context with a matching `context_parameter` given a branch', () => {
  const values: EnvelopeEnvVarValue[] = shuffle([
    {
      context: 'branch',
      context_parameter: 'staging',
      value: 'foo',
    },
    {
      context: 'dev',
      value: 'bar',
    },
  ])
  const result = getValueForContext(values, 'staging')
  expect(result).toHaveProperty('value', 'foo')
})

test('should not return a value from the `branch` context with a non-matching `context_parameter` given a branch', () => {
  const values: EnvelopeEnvVarValue[] = shuffle([
    {
      context: 'branch',
      context_parameter: 'staging',
      value: 'foo',
    },
    {
      context: 'dev',
      value: 'bar',
    },
  ])
  const result = getValueForContext(values, 'feat/make-it-pop')
  expect(result).toBeUndefined()
})

test('should return a matching value from the `branch-deploy` context given a branch and no `branch` context value', () => {
  const values: EnvelopeEnvVarValue[] = shuffle([
    {
      context: 'branch-deploy',
      value: 'foo',
    },
    {
      context: 'dev',
      value: 'bar',
    },
  ])
  const result = getValueForContext(values, 'feat/make-it-pop')
  expect(result).toHaveProperty('value', 'foo')
})

test('should return a matching value with the `branch` context given a branch and a `branch-deploy` value', () => {
  const values: EnvelopeEnvVarValue[] = shuffle([
    {
      context: 'branch-deploy',
      value: 'val from branch-deploy context',
    },
    {
      context: 'branch',
      context_parameter: 'feat/make-it-pop',
      value: 'val from branch context',
    },
    {
      context: 'dev',
      value: 'bar',
    },
  ])
  const result = getValueForContext(values, 'feat/make-it-pop')
  expect(result).toHaveProperty('value', 'val from branch context')
})

test('should filter an env from a given source', () => {
  const env = {
    FOO: {
      value: 'sup',
      sources: ['ui'],
    },
    BAR: {
      value: 'nm, u?',
      sources: ['general'],
    },
  }
  const filteredEnv = filterEnvBySource(env, 'ui')
  expect(filteredEnv).toEqual({
    FOO: {
      value: 'sup',
      sources: ['ui'],
    },
  })
})

test("should filter, sort, and format Envelope's response correctly", () => {
  const envelopeItems: EnvelopeItem[] = [
    {
      key: 'FOO',
      scopes: ['functions'],
      values: [
        {
          context: 'all',
          value: 'bar',
        },
      ],
    },
    {
      key: 'BAZ',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'production',
          value: 'bang',
        },
        {
          context: 'branch',
          context_parameter: 'staging',
          value: 'blah',
        },
      ],
    },
  ]

  expect(formatEnvelopeData({ context: 'dev', envelopeItems, scope: 'any', source: 'ui' })).toEqual({
    FOO: { branch: undefined, context: 'all', scopes: ['functions'], sources: ['ui'], value: 'bar' },
  })
  expect(formatEnvelopeData({ context: 'staging', envelopeItems, scope: 'runtime', source: 'account' })).toEqual({
    BAZ: {
      branch: 'staging',
      context: 'branch',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      sources: ['account'],
      value: 'blah',
    },
  })
  expect(formatEnvelopeData({ context: 'production', envelopeItems, source: 'general' })).toEqual({
    BAZ: {
      branch: undefined,
      context: 'production',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      sources: ['general'],
      value: 'bang',
    },
    FOO: { branch: undefined, context: 'all', scopes: ['functions'], sources: ['general'], value: 'bar' },
  })
})

test('should convert scope keys into a human-readable list', () => {
  expect(getHumanReadableScopes([])).toBe('')
  expect(getHumanReadableScopes()).toBe('Builds, Post processing')
  expect(getHumanReadableScopes(['post_processing'])).toBe('Post processing')
  expect(getHumanReadableScopes(['builds', 'functions'])).toBe('Builds, Functions')
  expect(getHumanReadableScopes(['builds', 'functions', 'runtime', 'post_processing'])).toBe('All')
})

test('should normalize a branch name or context', () => {
  expect(normalizeContext('branch:prod')).toBe('prod')
  expect(normalizeContext('branch:staging')).toBe('staging')
  expect(normalizeContext('dev')).toBe('dev')
  expect(normalizeContext('development')).toBe('development')
  expect(normalizeContext('dp')).toBe('deploy-preview')
  expect(normalizeContext('prod')).toBe('production')
  expect(normalizeContext('qa')).toBe('qa')
  expect(normalizeContext('staging')).toBe('staging')
  expect(normalizeContext('branch-deploy')).toBe('branch-deploy')
})

test('should translate from Mongo format to Envelope format when undefined', () => {
  const env = translateFromMongoToEnvelope()
  expect(env).toEqual([])
})

test('should translate from Mongo format to Envelope format when empty object', () => {
  const env = translateFromMongoToEnvelope({})
  expect(env).toEqual([])
})

test('should translate from Mongo format to Envelope format with one env var', () => {
  const env = translateFromMongoToEnvelope({ foo: 'bar' })
  expect(env).toEqual([
    {
      key: 'foo',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bar',
        },
      ],
    },
  ])
})

test('should translate from Mongo format to Envelope format with two env vars', () => {
  const env = translateFromMongoToEnvelope({ foo: 'bar', baz: 'bang' })
  expect(env).toEqual([
    {
      key: 'foo',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bar',
        },
      ],
    },
    {
      key: 'baz',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bang',
        },
      ],
    },
  ])
})

test('should translate from Envelope format to Mongo format when undefined', () => {
  const env = translateFromEnvelopeToMongo()
  expect(env).toEqual({})
})

test('should translate from Envelope format to Mongo format when empty array', () => {
  const env = translateFromEnvelopeToMongo([])
  expect(env).toEqual({})
})

test('should translate from Envelope format to Mongo format with one env var', () => {
  const env = translateFromEnvelopeToMongo([
    {
      key: 'foo',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bar',
        },
      ],
    },
  ])
  expect(env).toEqual({ foo: 'bar' })
})

test('should translate from Envelope format to Mongo format with two env vars', () => {
  const env = translateFromEnvelopeToMongo([
    {
      key: 'foo',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bar',
        },
      ],
    },
    {
      key: 'baz',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      values: [
        {
          context: 'all',
          value: 'bang',
        },
      ],
    },
  ])
  expect(env).toEqual({ foo: 'bar', baz: 'bang' })
})
