import { beforeEach, describe, expect, test, vi } from 'vitest'

import { reportError, setCommandForErrorReporting } from '../../../../src/utils/telemetry/report-error.js'
import execa from '../../../../src/utils/execa.js'

vi.mock('ci-info', () => ({ isCI: false }))

vi.mock('@netlify/dev-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@netlify/dev-utils')>()),
  getGlobalConfigStore: vi.fn(() => Promise.resolve({ get: () => 'test-user-1' })),
}))

vi.mock('../../../../src/utils/execa.js', () => ({ default: vi.fn(() => Promise.resolve({})) }))

interface ReportedData {
  metadata: Record<string, Record<string, unknown>>
}

const getReportedPayload = (): ReportedData => {
  const { calls } = vi.mocked(execa).mock
  const [, [, optionsJson]] = calls[calls.length - 1] as [string, string[]]
  return (JSON.parse(optionsJson) as { data: ReportedData }).data
}

beforeEach(() => {
  vi.clearAllMocks()
  setCommandForErrorReporting()
})

describe('reportError', () => {
  test('omits the command section when no command has been recorded', async () => {
    await reportError(new Error('boom'), { severity: 'error' })

    const { metadata } = getReportedPayload()
    expect(metadata).toEqual({})
  })

  test('includes the recorded command name and merges caller metadata', async () => {
    setCommandForErrorReporting('logs:deploy')
    await reportError(new Error('boom'), {
      severity: 'error',
      metadata: { build: { framework: 'astro' } },
    })

    const { metadata } = getReportedPayload()
    expect(metadata).toEqual({
      command: { name: 'logs:deploy' },
      build: { framework: 'astro' },
    })
  })

  test('keeps the tracked command authoritative over caller metadata', async () => {
    setCommandForErrorReporting('deploy')
    await reportError(new Error('boom'), {
      severity: 'error',
      metadata: { command: { name: 'spoofed' } },
    })

    const { metadata } = getReportedPayload()
    expect(metadata.command).toEqual({ name: 'deploy' })
  })
})
