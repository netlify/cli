import { Buffer } from 'buffer'

import { describe, expect, test } from 'vitest'

import { createSiteInfoHeader } from '../../../../dist/lib/edge-functions/proxy.js'

describe('createSiteInfoHeader', () => {
  test('builds a base64 string', () => {
    const siteInfo = { id: 'site_id', name: 'site_name', url: 'site_url' }
    const output = createSiteInfoHeader(siteInfo)
    const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

    expect(parsedOutput).toEqual(siteInfo)
  })

  test('builds a base64 string if there is no siteInfo passed', () => {
    const siteInfo = {}
    const output = createSiteInfoHeader(siteInfo)
    const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

    expect(parsedOutput).toEqual({})
  })
})
