import { expect, test, vi } from 'vitest'

import { runFunctionsProxy } from '../../../../../../dist/lib/functions/local-proxy.js'
import { invokeFunction } from '../../../../../../dist/lib/functions/runtimes/rust/index.js'

vi.mock('../../../../../../dist/lib/functions/local-proxy.js', () => ({ runFunctionsProxy: vi.fn() }))

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
