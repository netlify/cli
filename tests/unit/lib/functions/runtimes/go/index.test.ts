import { expect, test, vi } from 'vitest'

import { runFunctionsProxy } from '../../../../../../dist/lib/functions/local-proxy.js'
import { invokeFunction } from '../../../../../../dist/lib/functions/runtimes/go/index.js'

vi.mock('../../../../../../dist/lib/functions/local-proxy.js', () => ({ runFunctionsProxy: vi.fn() }))

test.each([
  ['body', 'thebody'] as const,
  ['headers', { 'X-Single': 'A' }] as const,
  ['multiValueHeaders', { 'X-Multi': ['B', 'C'] }] as const,
  ['statusCode', 200] as const,
])('should return %s', async (prop, expected) => {
  // @ts-expect-error -- TODO(serhalp) Lazy test type. Create a factory and use it here.
  vi.mocked(runFunctionsProxy).mockResolvedValue({ stdout: JSON.stringify({ [prop]: expected }) })

  // @ts-expect-error -- TODO(serhalp) Lazy test type. Create a factory and use it here.
  const match = await invokeFunction({ func: { mainFile: '', buildData: { binaryPath: 'foo' } } })
  expect(match[prop]).toEqual(expected)
})
