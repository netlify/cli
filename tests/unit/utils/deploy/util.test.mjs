import { describe, expect, test } from 'vitest'

import { normalizePath } from '../../../../src/utils/deploy/util.mjs'

describe('normalizePath', () => {

  test('normalizes "netlify.toml" config files', () => {
    const configFileObj = {
      dirent: {},
      // the 'name' and 'path' object fields are the same when an absolute path
      // for the config file is passed to 'fast-glob', as done in
      // `hash-files.mjs`.
      name: '/home/netlify/project/netlify.toml',
      path: '/home/netlify/project/netlify.toml'
    }

    const paths = {
      configPath: '/home/netlify/project/netlify.toml',
      deployFolder: '/home/netlify/project/public',
      edgeFunctionsFolder: '/home/netlify/project/.netlify/edge-functions-dist'
    }
    expect(normalizePath(configFileObj, paths)).toBe('netlify.toml')
  })

  test('normalizes edge function files', () => {
    const edgeFnFileObj = {
      dirent: {},
      name: 'manifest.json',
      path: '/home/netlify/project/.netlify/edge-functions-dist/manifest.json'
    }

    const paths = {
      configPath: '/home/netlify/project/netlify.toml',
      deployFolder: '/home/netlify/project/public',
      edgeFunctionsFolder: '/home/netlify/project/.netlify/edge-functions-dist'
    }
    expect(normalizePath(edgeFnFileObj, paths)).toBe('.netlify/internal/edge-functions/manifest.json')
  })

  test('normalizes regular deploy files', () => {
    const deployFileObj = {
      dirent: {},
      name: 'index.html',
      path: '/home/netlify/project/public/folder/index.html'
    }

    const paths = {
      configPath: '/home/netlify/project/netlify.toml',
      deployFolder: '/home/netlify/project/public',
      edgeFunctionsFolder: '/home/netlify/project/.netlify/edge-functions-dist'
    }
    expect(normalizePath(deployFileObj, paths)).toBe('folder/index.html')
  })

  test('normalizePath should throw the error if name is invalid', () => {
    expect(() => normalizePath('invalid name#')).toThrowError()
    expect(() => normalizePath('invalid name?')).toThrowError()
    expect(() => normalizePath('??')).toThrowError()
    expect(() => normalizePath('#')).toThrowError()
  })
})
