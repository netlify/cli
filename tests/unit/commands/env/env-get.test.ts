import { describe, expect, test, vi, beforeEach, afterEach, type MockInstance } from 'vitest'

const { mockGetEnvelopeEnv, jsonMessages, logMessages } = vi.hoisted(() => ({
  mockGetEnvelopeEnv: vi.fn(),
  jsonMessages: [] as unknown[],
  logMessages: [] as string[],
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
  exit: (code = 0): never => {
    throw new Error(`process.exit(${String(code)})`)
  },
}))

vi.mock('../../../../src/utils/env/index.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/env/index.js')),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  getEnvelopeEnv: (...args: unknown[]) => mockGetEnvelopeEnv(...args),
}))

import { envGet } from '../../../../src/commands/env/env-get.js'
import type BaseCommand from '../../../../src/commands/base-command.js'

const createMockCommand = ({ linkedSiteId, flagSiteId }: { linkedSiteId?: string; flagSiteId?: string } = {}) => {
  const api = { getSite: vi.fn().mockResolvedValue({ id: flagSiteId, name: 'flag-site' }) }
  const command = {
    netlify: {
      api,
      cachedConfig: { env: {}, siteInfo: { id: linkedSiteId } },
      site: { id: linkedSiteId },
      siteInfo: { id: flagSiteId },
    },
  } as unknown as BaseCommand
  return { api, command }
}

describe('envGet', () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>

  beforeEach(() => {
    jsonMessages.length = 0
    logMessages.length = 0
    vi.clearAllMocks()
    mockGetEnvelopeEnv.mockResolvedValue({ FOO: { value: 'bar' } })
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  test('prints a NOT_LINKED JSON envelope and exits non-zero when unlinked with --json', async () => {
    const { command } = createMockCommand()

    await expect(envGet('FOO', { json: true }, command)).rejects.toThrowError('process.exit(1)')

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toMatchObject({ error: { code: 'NOT_LINKED', fix: 'netlify link' } })
    expect(mockGetEnvelopeEnv).not.toHaveBeenCalled()
  })

  test('prints prose to stderr and exits non-zero when unlinked without --json', async () => {
    const { command } = createMockCommand()

    await expect(envGet('FOO', {}, command)).rejects.toThrowError('process.exit(1)')

    expect(stderrSpy).toHaveBeenCalledWith(
      'No project id found, please run inside a project folder or `netlify link`\n',
    )
    expect(jsonMessages).toHaveLength(0)
  })

  test('returns the variable for the linked site without --site', async () => {
    const { command } = createMockCommand({ linkedSiteId: 'linked-id' })

    await envGet('FOO', { json: true, context: 'dev', scope: 'any' }, command)

    expect(jsonMessages).toEqual([{ FOO: 'bar' }])
  })

  test('honors --site by using the resolved siteInfo instead of the linked state', async () => {
    const { api, command } = createMockCommand({ flagSiteId: 'flag-site-id' })

    await envGet('FOO', { json: true, context: 'dev', scope: 'any', site: 'flag-site-id' }, command)

    expect(api.getSite).toHaveBeenCalledWith({ siteId: 'flag-site-id' })
    const [envelopeArgs] = mockGetEnvelopeEnv.mock.calls[0] as [{ siteInfo: { id: string } }]
    expect(envelopeArgs.siteInfo.id).toBe('flag-site-id')
    expect(jsonMessages).toEqual([{ FOO: 'bar' }])
  })

  test('prefers --site over the linked site id', async () => {
    const { api, command } = createMockCommand({ linkedSiteId: 'linked-id', flagSiteId: 'flag-site-id' })

    await envGet('FOO', { json: true, context: 'dev', scope: 'any', site: 'flag-site-id' }, command)

    expect(api.getSite).toHaveBeenCalledWith({ siteId: 'flag-site-id' })
    const [envelopeArgs] = mockGetEnvelopeEnv.mock.calls[0] as [{ siteInfo: { id: string } }]
    expect(envelopeArgs.siteInfo.id).toBe('flag-site-id')
  })
})
