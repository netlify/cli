const path = require('path')

const sortOn = require('sort-on')

const { withSiteBuilder } = require('../../../tests/utils/site-builder')

const { getFunctions, getFunctionsAndWatchDirs } = require('./get-functions')

test('should return empty object when an empty string is provided', async () => {
  const funcs = await getFunctions('')
  expect(funcs).toEqual([])
})

test('should return an empty object for a directory with no js files', async () => {
  await withSiteBuilder('site-without-functions', async (builder) => {
    await builder.buildAsync()

    const funcs = await getFunctions(builder.directory)
    expect(funcs).toEqual([])
  })
})

test('should return object with function details for a directory with js files', async () => {
  await withSiteBuilder('site-without-functions', async (builder) => {
    builder.withFunction({
      path: 'index.js',
      handler: '',
    })
    await builder.buildAsync()

    const functions = path.join(builder.directory, 'functions')
    const funcs = await getFunctions(functions)
    expect(funcs).toEqual([
      {
        name: 'index',
        mainFile: path.join(builder.directory, 'functions', 'index.js'),
        isBackground: false,
        runtime: 'js',
        schedule: undefined,
        urlPath: '/.netlify/functions/index',
      },
    ])
  })
})

test('should mark background functions based on filenames', async () => {
  await withSiteBuilder('site-without-functions', async (builder) => {
    builder
      .withFunction({
        path: 'foo-background.js',
        handler: '',
      })
      .withFunction({
        path: 'bar-background/bar-background.js',
        handler: '',
      })
    await builder.buildAsync()

    const functions = path.join(builder.directory, 'functions')
    const funcs = await getFunctions(functions)
    expect(sortOn(funcs, ['mainFile', 'extension'])).toEqual([
      {
        name: 'bar-background',
        mainFile: path.join(builder.directory, 'functions', 'bar-background', 'bar-background.js'),
        isBackground: true,
        runtime: 'js',
        schedule: undefined,
        urlPath: '/.netlify/functions/bar-background',
      },
      {
        name: 'foo-background',
        mainFile: path.join(builder.directory, 'functions', 'foo-background.js'),
        isBackground: true,
        runtime: 'js',
        schedule: undefined,
        urlPath: '/.netlify/functions/foo-background',
      },
    ])
  })
})

test.skip('should return additional watch dirs when functions requires a file outside function dir', async () => {
  await withSiteBuilder('site-with-functions-require-outside-functions-dir', async (builder) => {
    await builder
      .withFunction({
        path: 'index.js',
        // eslint-disable-next-line require-await
        handler: async () => {
          // eslint-disable-next-line node/global-require, import/no-unresolved, node/no-missing-require
          const { logHello } = require('../utils')
          logHello()
          return { statusCode: 200, body: 'Logged Hello!' }
        },
      })
      .withContentFile({
        path: 'utils/index.js',
        content: `const logHello = () => console.log('hello'); module.exports = { logHello }`,
      })
      .buildAsync()

    const { functions, watchDirs } = await getFunctionsAndWatchDirs(path.join(builder.directory, 'functions'))
    expect(functions).toEqual([
      {
        name: 'index',
        mainFile: path.join(builder.directory, 'functions', 'index.js'),
        isBackground: false,
        runtime: 'js',
        urlPath: '/.netlify/functions/index',
      },
    ])
    expect(watchDirs).toEqual([path.join(builder.directory, 'functions'), path.join(builder.directory, 'utils')])
  })
})
