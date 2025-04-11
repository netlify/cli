import { describe, expect, test } from 'vitest'

import { getLanguage } from '../../../src/utils/rules-proxy.js'

describe('getLanguage', () => {
  test('detects language', () => {
    const language = getLanguage({ 'accept-language': 'ur' })

    expect(language).toBe('ur')
  })
})
