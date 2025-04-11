import { expect, test } from 'vitest'

import NetlifyFunction from '../../../../src/lib/functions/netlify-function.js'

test('should return the correct function url for a NetlifyFunction object', () => {
  const port = 7331
  const functionName = 'test-function'

  const functionUrl = `http://localhost:${port.toString()}/.netlify/functions/${functionName}`

  const ntlFunction = new NetlifyFunction({
    name: functionName,
    settings: { functionsPort: port },
    // @ts-expect-error TS(2741) FIXME: Property ''*'' is missing in type '{ "test-functio... Remove this comment to see the full error message
    config: { functions: { [functionName]: {} } },
  })

  expect(ntlFunction.url).toBe(functionUrl)
})
