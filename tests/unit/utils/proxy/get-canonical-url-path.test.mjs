import { describe, expect, test } from 'vitest'

import getCanonicalPath from '../../../../src/utils/proxy/get-canonical-url-path.mjs'

const testCases = [
  ['/folder/index.html', '/folder/'],
  ['/folder/index.htm', '/folder/'],

  ['/folder/index.htm/index.html', '/folder/index.htm/'],
  ['/folder/index.htm/index.htm', '/folder/index.htm/'],
  ['/folder/index.html/index.html', '/folder/index.html/'],
  ['/folder/index.html/index.htm', '/folder/index.html/'],

  ['/file.html', '/file'],
  ['/file.htm', '/file'],

  ['/file.css', '/file.css'],
]

describe('getCanonicalPath', () => {
  test.each(testCases)('canonical path for %s is %s', (staticFile, expected) => {
    expect(getCanonicalPath(staticFile)).toEqual(expected)
  })
})
