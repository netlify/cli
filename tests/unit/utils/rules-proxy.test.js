import { describe, expect, test } from 'vitest'

import { getLanguage } from '../../../dist/utils/rules-proxy.js'

describe('getLanguage', () => {
  test('detects language', () => {
    const language = getLanguage({ 'accept-language': 'ur' })

    expect(language).toBe('ur')
  })
})
