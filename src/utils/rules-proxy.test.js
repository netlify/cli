import test from 'ava'

import { getLanguage } from './rules-proxy.js'

test('getLanguage', (t) => {
  const language = getLanguage({ 'accept-language': 'ur' })

  t.is(language, 'ur')
})
