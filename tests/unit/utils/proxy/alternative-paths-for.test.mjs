import { describe, expect, test } from 'vitest'

import alternativePathsFor from '../../../../src/utils/proxy/alternative-paths-for.mjs'

describe('alternativePathsFor', () => {
  test('folder url', () => {
    expect(alternativePathsFor('/folder/')).toMatchSnapshot()
  })

  test('file url', () => {
    expect(alternativePathsFor('/file')).toMatchSnapshot()
  })

  test('file in subfolder url', () => {
    expect(alternativePathsFor('/folder/index.html')).toMatchSnapshot()
  })
})
