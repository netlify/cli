const { getLanguage } = require('./rules-proxy')

test('getLanguage', () => {
  const language = getLanguage({ 'accept-language': 'ur' })

  expect(language).toBe('ur')
})
