import { expect, test, vi } from 'vitest'
import type { ExecaReturnValue } from 'execa'

import { runFunctionsProxy } from '../../../../../../src/lib/functions/local-proxy.js'
import * as goRuntime from '../../../../../../src/lib/functions/runtimes/go/index.js'
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

  const func = createNetlifyFunction({ runtime: goRuntime })
  func.buildData = { binaryPath: 'foo' }

  const match = await goRuntime.invokeFunction({ context: {}, environment: {}, event: {}, func, timeout: 0 })
  expect(match[prop]).toEqual(expected)
})
