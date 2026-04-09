import { expect, test, vi } from 'vitest'

import { runFunctionsProxy } from '../../../../../../src/lib/functions/local-proxy.js'
import { invokeFunction } from '../../../../../../src/lib/functions/runtimes/rust/index.js'

vi.mock('../../../../../../src/lib/functions/local-proxy.js', () => ({ runFunctionsProxy: vi.fn() }))

test.each([
  ['body', 'thebody'] as const,
  ['headers', { 'X-Single': 'A' }] as const,
  ['multiValueHeaders', { 'X-Multi': ['B', 'C'] }] as const,
  ['statusCode', 200] as const,
])('should return %s', async (prop, expected) => {
  vi.mocked(runFunctionsProxy).mockResolvedValue(
    // @ts-expect-error(ndhoule): Intentionally not mocking entire execa API surface
    { stdout: JSON.stringify({ [prop]: expected }) },
  )

  // @ts-expect-error TS(2740) FIXME: Type '{ mainFile: string; buildData: { binaryPath:... Remove this comment to see the full error message
  const match = await invokeFunction({ func: { mainFile: '', buildData: { binaryPath: 'foo' } } })
  expect(match[prop]).toEqual(expected)
})
