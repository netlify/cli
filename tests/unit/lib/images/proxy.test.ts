import { expect, test } from 'vitest'

import { parseAllRemoteImages, transformImageParams } from '../../../../src/lib/images/proxy.js'

test('should parse all remote images correctly', () => {
  const config = {
    images: {
      remote_images: ['https://example.com/*', 'https://test.com/*'],
    },
  }
  const { errors, remotePatterns } = parseAllRemoteImages(config)
  expect(errors).toEqual([])
  expect(remotePatterns).toEqual([/https:\/\/example.com\/*/, /https:\/\/test.com\/*/])
})

test('should report invalid remote images', () => {
  const config = {
    images: {
      remote_images: ['*'],
    },
  }
  const { errors, remotePatterns } = parseAllRemoteImages(config)
  expect(errors).toEqual([
    {
      message: 'Invalid regular expression: /*/: Nothing to repeat',
    },
  ])
  expect(remotePatterns).toEqual([])
})

test('should transform image params correctly - without fit or position', () => {
  const query = {
    w: '100',

    q: '80',
    fm: 'jpg',
  }
  const result = transformImageParams(query)
  expect(result).toEqual('w_100,quality_80,format_jpg')
})

test('should transform image params correctly - resize', () => {
  const query = {
    w: '100',
    h: '200',
    q: '80',
    fm: 'jpg',
    fit: 'cover',
    position: 'center',
  }
  const result = transformImageParams(query)
  expect(result).toEqual('s_100x200,quality_80,format_jpg,fit_cover,position_center')
})

test('should transform image params correctly - fit is contain', () => {
  const query = {
    w: '100',
    h: '200',
    q: '80',
    fm: 'jpg',
    fit: 'contain',
    position: 'center',
  }
  const result = transformImageParams(query)
  expect(result).toEqual('s_100x200,quality_80,format_jpg,fit_inside,position_center')
})
