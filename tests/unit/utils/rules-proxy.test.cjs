import { describe, test } from 'vitest'

const { getLanguage } = require('../../../src/utils/rules-proxy.mjs')

describe('getLanguage', () => {
  test('detects language', (t) => {
    const language = getLanguage({ 'accept-language': 'ur' })

    t.is(language, 'ur')
  })
})
