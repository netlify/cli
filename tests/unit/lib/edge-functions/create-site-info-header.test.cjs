const { Buffer } = require('buffer')

const test = require('ava')

const { createSiteInfoHeader } = require('../../../../src/lib/edge-functions/proxy.cjs')

test('createSiteInfoHeader builds a base64 string', (t) => {
  const siteInfo = { id: 'site_id', name: 'site_name', url: 'site_url' }
  const output = createSiteInfoHeader(siteInfo)
  const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

  t.deepEqual(parsedOutput, siteInfo)
})

test('createSiteInfoHeader builds a base64 string if there is no siteInfo passed', (t) => {
  const siteInfo = {}
  const output = createSiteInfoHeader(siteInfo)
  const parsedOutput = JSON.parse(Buffer.from(output, 'base64').toString('utf-8'))

  t.deepEqual(parsedOutput, {})
})
