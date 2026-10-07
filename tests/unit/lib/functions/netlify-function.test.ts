import { expect, test } from 'vitest'

import * as jsRuntime from '../../../../src/lib/functions/runtimes/js/index.js'

import { createNetlifyFunction } from './fixtures.js'

test('should return the correct function url for a NetlifyFunction object', () => {
  const port = 7331
  const functionName = 'test-function'

  const functionUrl = `http://localhost:${port.toString()}/.netlify/functions/${functionName}`

  const ntlFunction = createNetlifyFunction({
    name: functionName,
    runtime: jsRuntime,
    settings: { functionsPort: port },
  })

  expect(ntlFunction.url).toBe(functionUrl)
})
