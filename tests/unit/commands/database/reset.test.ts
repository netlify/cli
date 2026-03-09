import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockStart, mockStop, mockReset, MockNetlifyDev, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockStart = vi.fn().mockResolvedValue({})
  const mockStop = vi.fn().mockResolvedValue(undefined)
  const mockReset = vi.fn().mockResolvedValue(undefined)
  const MockNetlifyDev = vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    db: { reset: mockReset },
  }))
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockStart, mockStop, mockReset, MockNetlifyDev, logMessages, jsonMessages }
})

vi.mock('@netlify/dev', () => ({
  NetlifyDev: MockNetlifyDev,
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
}))

import { reset } from '../../../../src/commands/database/reset.js'

function createMockCommand(overrides: { buildDir?: string; projectRoot?: string; dbUrl?: string } = {}) {
  const { buildDir = '/project', projectRoot = '/project', dbUrl } = overrides

  return {
    project: { root: projectRoot, baseDirectory: undefined },
    netlify: {
      site: { root: buildDir },
      config: {},
      state: { get: (key: string) => (key === 'db.url' ? dbUrl : undefined) },
    },
  } as unknown as Parameters<typeof reset>[1]
}

describe('reset', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
  })

  test('starts NetlifyDev, resets the database, and stops', async () => {
    await reset({}, createMockCommand())

    expect(mockStart).toHaveBeenCalledOnce()
    expect(mockReset).toHaveBeenCalledOnce()
    expect(mockStop).toHaveBeenCalledOnce()
  })

  test('passes db connection string to NetlifyDev when running db is detected', async () => {
    const dbUrl = 'postgres://localhost:54321/postgres'
    await reset({}, createMockCommand({ dbUrl }))

    expect(MockNetlifyDev).toHaveBeenCalledWith(
      expect.objectContaining({
        db: { connectionString: dbUrl },
      }),
    )
  })

  test('does not pass db option when no running db is detected', async () => {
    await reset({}, createMockCommand())

    const constructorArg = MockNetlifyDev.mock.calls[0][0] as Record<string, unknown>
    expect(constructorArg).not.toHaveProperty('db')
  })

  test('logs success message after reset', async () => {
    await reset({}, createMockCommand())

    expect(logMessages).toContain('Local development database has been reset.')
  })

  test('outputs JSON when --json flag is set', async () => {
    await reset({ json: true }, createMockCommand())

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({ reset: true })
  })

  test('stops NetlifyDev even when reset throws', async () => {
    mockReset.mockRejectedValueOnce(new Error('reset failed'))

    await expect(reset({}, createMockCommand())).rejects.toThrow('reset failed')

    expect(mockStop).toHaveBeenCalledOnce()
  })

  test('throws when db is not available after start', async () => {
    MockNetlifyDev.mockImplementationOnce(() => ({
      start: mockStart,
      stop: mockStop,
      db: undefined,
    }))

    await expect(reset({}, createMockCommand())).rejects.toThrow('Local database failed to start')
  })

  test('throws when project root cannot be determined', async () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined },
      netlify: { site: { root: undefined }, config: {}, state: { get: () => undefined } },
    } as unknown as Parameters<typeof reset>[1]

    await expect(reset({}, command)).rejects.toThrow('Could not determine the project root directory.')
  })
})
