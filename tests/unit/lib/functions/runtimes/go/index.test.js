import { expect, test, vi } from 'vitest'

import { runFunctionsProxy } from '../../../../../../src/lib/functions/local-proxy.js'
import { invokeFunction } from '../../../../../../src/lib/functions/runtimes/go/index.js'

vi.mock('../../../../../../src/lib/functions/local-proxy.js', () => ({ runFunctionsProxy: vi.fn() }))

test.each([
  ['body', 'thebody'],
  ['headers', { 'X-Single': 'A' }],
  ['multiValueHeaders', { 'X-Multi': ['B', 'C'] }],
  ['statusCode', 200],
])('should return %s', async (prop, expected) => {
  runFunctionsProxy.mockImplementation(() => Promise.resolve({ stdout: JSON.stringify({ [prop]: expected }) }))

  const match = await invokeFunction({ func: { mainFile: '', buildData: {} } })
  expect(match[prop]).toEqual(expected)
})
