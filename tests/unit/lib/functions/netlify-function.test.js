import { expect, test } from 'vitest'

import NetlifyFunction from '../../../../dist/lib/functions/netlify-function.js'

test('should return the correct function url for a NetlifyFunction object', () => {
  const port = 7331
  const functionName = 'test-function'

  const functionUrl = `http://localhost:${port}/.netlify/functions/${functionName}`

  const ntlFunction = new NetlifyFunction({
    name: functionName,
    settings: { functionsPort: port },
    config: { functions: { [functionName]: {} } },
  })

  expect(ntlFunction.url).toBe(functionUrl)
})
