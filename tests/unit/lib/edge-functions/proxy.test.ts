import { Buffer } from 'buffer'

import { describe, expect, test } from 'vitest'

import { createSiteInfoHeader } from '../../../../dist/lib/edge-functions/proxy.js'

describe('createSiteInfoHeader', () => {
  test('builds a base64 string', () => {
    const siteInfo = { id: 'site_id', name: 'site_name', url: 'site_url' }
    // @ts-expect-error TS(2554) FIXME: Expected 2 arguments, but got 1.
    const output = createSiteInfoHeader(siteInfo)
    const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

    expect(parsedOutput).toEqual(siteInfo)
  })

  test('builds a base64 string if there is no siteInfo passed', () => {
    const siteInfo = {}
    // @ts-expect-error TS(2554) FIXME: Expected 2 arguments, but got 1.
    const output = createSiteInfoHeader(siteInfo)
    const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

    expect(parsedOutput).toEqual({})
  })
})
