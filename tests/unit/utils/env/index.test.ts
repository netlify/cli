import { expect, test } from 'vitest'

import {
  filterEnvBySource,
  getValueForContext,
  formatEnvelopeData,
  getHumanReadableScopes,
  normalizeContext,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
} from '../../../../src/utils/env/index.js'

test('should find a value from a given context', () => {
  const values = [
    {
      context: 'production' as const,
      value: 'foo',
    },
    {
      context: 'dev' as const,
      value: 'bar',
    },
  ]
  const result = getValueForContext(values, 'dev')
  expect(result).toHaveProperty('value', 'bar')
})

test('should find a value from a given branch', () => {
  const values = [
    {
      context: 'branch-deploy' as const,
      context_parameter: 'staging',
      value: 'foo',
    },
    {
      context: 'dev' as const,
      value: 'bar',
    },
  ]
  const result = getValueForContext(values, 'staging')
  expect(result).toHaveProperty('value', 'foo')
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
  const envelopeItems = [
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
  expect(getHumanReadableScopes(['post-processing'])).toBe('Post processing')
  expect(getHumanReadableScopes(['builds', 'functions'])).toBe('Builds, Functions')
  expect(getHumanReadableScopes(['builds', 'functions', 'runtime', 'post_processing'])).toBe('All')
  expect(getHumanReadableScopes(['builds', 'functions', 'runtime', 'post-processing'])).toBe('All')
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
