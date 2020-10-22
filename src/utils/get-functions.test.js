const test = require('ava')
const path = require('path')
const { withSiteBuilder } = require('../../tests/utils/site-builder')
const { getFunctions } = require('./get-functions.js')
const { findModuleDir } = require('./finders')

test('should return empty object when an empty string is provided', (t) => {
  const funcs = getFunctions('')
  t.deepEqual(funcs, {})
})

test('should return an empty object for a directory with no js files', async (t) => {
  await withSiteBuilder('site-without-functions', async (builder) => {
    await builder.buildAsync()

    const funcs = getFunctions(builder.directory)
    t.deepEqual(funcs, {})
  })
})

test('should return object with function details for a directory with js files', async (t) => {
  await withSiteBuilder('site-without-functions', async (builder) => {
    builder.withFunction({
      path: 'index.js',
      handler: '',
    })
    await builder.buildAsync()

    const functions = path.join(builder.directory, 'functions')
    const funcs = getFunctions(functions)
    t.deepEqual(funcs, {
      index: {
        functionPath: path.join(functions, 'index.js'),
        moduleDir: findModuleDir(functions),
      },
    })
  })
})
