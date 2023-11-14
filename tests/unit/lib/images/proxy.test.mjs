import { expect, test } from 'vitest'

import { parseAllDomains, transformImageParams } from '../../../../src/lib/images/proxy.mjs'

test('should parse all domains correctly', () => {
  const config = {
    images: {
      remote_images: ['https://example.com/*', 'https://test.com/*'],
    },
  }
  const { errors, remoteDomains } = parseAllDomains(config)
  expect(errors).toEqual([])
  expect(remoteDomains).toEqual(['example.com', 'test.com'])
})

test('should transform image params correctly', () => {
  const query = {
    // eslint-disable-next-line id-length
    w: '100',
    // eslint-disable-next-line id-length
    h: '200',
    // eslint-disable-next-line id-length
    q: '80',
    fm: 'jpg',
    fit: 'cover',
    position: 'center',
  }
  const result = transformImageParams(query)
  expect(result).toEqual('w_100,h_200,quality_80,format_jpg,fit_cover,position_center')
})
