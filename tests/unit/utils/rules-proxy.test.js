const test = require('ava')

const { getLanguage } = require('../../../src/utils/rules-proxy')

test('getLanguage', (t) => {
  const language = getLanguage({ 'accept-language': 'ur' })

  t.is(language, 'ur')
})
