const test = require('ava')

const { getLanguage } = require('../../../src/utils/rules-proxy.cjs')

test('getLanguage', (t) => {
  const language = getLanguage({ 'accept-language': 'ur' })

  t.is(language, 'ur')
})
