const test = require('ava')

const { translateFromEnvelopeToMongo, translateFromMongoToEnvelope } = require('../../../../src/utils/env')

test('should translate from Mongo format to Envelope format when undefined', (t) => {
  const env = translateFromMongoToEnvelope()
  t.deepEqual(env, [])
})

test('should translate from Mongo format to Envelope format when empty object', (t) => {
  const env = translateFromMongoToEnvelope({})
  t.deepEqual(env, [])
})

test('should translate from Mongo format to Envelope format with one env var', (t) => {
  const env = translateFromMongoToEnvelope({ foo: 'bar' })
  t.deepEqual(env, [
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

test('should translate from Mongo format to Envelope format with two env vars', (t) => {
  const env = translateFromMongoToEnvelope({ foo: 'bar', baz: 'bang' })
  t.deepEqual(env, [
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

test('should translate from Envelope format to Mongo format when undefined', (t) => {
  const env = translateFromEnvelopeToMongo()
  t.deepEqual(env, {})
})

test('should translate from Envelope format to Mongo format when empty array', (t) => {
  const env = translateFromEnvelopeToMongo([])
  t.deepEqual(env, {})
})

test('should translate from Envelope format to Mongo format with one env var', (t) => {
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
  t.deepEqual(env, { foo: 'bar' })
})

test('should translate from Envelope format to Mongo format with two env vars', (t) => {
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
  t.deepEqual(env, { foo: 'bar', baz: 'bang' })
})
