import { expect, test, vi } from 'vitest'
import type { ExecaReturnValue } from 'execa'

import { runFunctionsProxy } from '../../../../../../src/lib/functions/local-proxy.js'
import * as rustRuntime from '../../../../../../src/lib/functions/runtimes/rust/index.js'
import { createNetlifyFunction } from '../../fixtures.js'

vi.mock('../../../../../../src/lib/functions/local-proxy.js', () => ({ runFunctionsProxy: vi.fn() }))

test.each([
  ['body', 'thebody'] as const,
  ['headers', { 'X-Single': 'A' }] as const,
  ['multiValueHeaders', { 'X-Multi': ['B', 'C'] }] as const,
  ['statusCode', 200] as const,
])('should return %s', async (prop, expected) => {
  vi.mocked(runFunctionsProxy).mockResolvedValue(
    // This mock doesn't implement the full execa return value API, just the part put under test
    { stdout: JSON.stringify({ [prop]: expected }) } as ExecaReturnValue,
  )

  const func = createNetlifyFunction({ runtime: rustRuntime })
  func.buildData = { binaryPath: 'foo' }

  const match = await rustRuntime.invokeFunction({ context: {}, environment: {}, event: {}, func, timeout: 0 })
  expect(match[prop]).toEqual(expected)
})
