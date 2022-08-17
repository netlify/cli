const test = require('ava')

const {
  filterEnvBySource,
  findValueFromContext,
  formatEnvelopeData,
  getHumanReadableScopes,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
} = require('../../../../src/utils/env')

test('should find a value from a given context', (t) => {
  const values = [
    {
      context: 'production',
      value: 'foo',
    },
    {
      context: 'dev',
      value: 'bar',
    },
  ]
  const { value } = findValueFromContext(values, 'dev')
  t.is(value, 'bar')
})

test('should filter an env from a given source', (t) => {
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
  t.deepEqual(filteredEnv, {
    FOO: {
      value: 'sup',
      sources: ['ui'],
    },
  })
})

test("should filter, sort, and format Envelope's response correctly", (t) => {
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
          context: 'deploy-preview',
          value: 'blah',
        },
      ],
    },
  ]

  t.deepEqual(formatEnvelopeData({ context: 'dev', envelopeItems, scope: 'any', source: 'ui' }), {
    FOO: { context: 'all', scopes: ['functions'], sources: ['ui'], value: 'bar' },
  })
  t.deepEqual(formatEnvelopeData({ context: 'deploy-preview', envelopeItems, scope: 'runtime', source: 'account' }), {
    BAZ: {
      context: 'deploy-preview',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      sources: ['account'],
      value: 'blah',
    },
  })
  t.deepEqual(formatEnvelopeData({ context: 'production', envelopeItems, source: 'general' }), {
    BAZ: {
      context: 'production',
      scopes: ['builds', 'functions', 'runtime', 'post_processing'],
      sources: ['general'],
      value: 'bang',
    },
    FOO: { context: 'all', scopes: ['functions'], sources: ['general'], value: 'bar' },
  })
})

test('should convert scope keys into a human-readable list', (t) => {
  t.is(getHumanReadableScopes([]), '')
  t.is(getHumanReadableScopes(), 'Builds, Post processing')
  t.is(getHumanReadableScopes(['post_processing']), 'Post processing')
  t.is(getHumanReadableScopes(['builds', 'functions']), 'Builds, Functions')
  t.is(getHumanReadableScopes(['builds', 'functions', 'runtime', 'post_processing']), 'All')
})

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
