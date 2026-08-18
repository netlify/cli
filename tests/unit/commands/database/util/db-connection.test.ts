import { join } from 'path'

import { beforeEach, describe, expect, test, vi } from 'vitest'

const { capturedOptions, mockStart, mockStop, localState, mockClientConnect, warnMessages } = vi.hoisted(() => ({
  capturedOptions: [] as { logger?: { warn: (message?: string) => void } }[],
  mockStart: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  mockStop: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  localState: new Map<string, string>(),
  mockClientConnect: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  warnMessages: [] as string[],
}))

vi.mock('@netlify/dev', () => ({
  NetlifyDev: class {
    constructor(options: (typeof capturedOptions)[number]) {
      capturedOptions.push(options)
    }
    start() {
      return mockStart()
    }
    stop() {
      return mockStop()
    }
  },
}))

vi.mock('@netlify/dev-utils', () => ({
  LocalState: class {
    get(key: string) {
      return localState.get(key)
    }
    delete(key: string) {
      localState.delete(key)
    }
  },
}))

vi.mock('pg', () => ({
  Client: class {
    connect() {
      return mockClientConnect()
    }
    end() {
      return Promise.resolve()
    }
  },
}))

vi.mock('../../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../../src/utils/command-helpers.js')),
  warn: (message: string) => {
    warnMessages.push(message)
  },
}))

import {
  connectRawClient,
  getLocalDatabaseDirectory,
  LocalDatabaseStartError,
} from '../../../../../src/commands/database/util/db-connection.js'

const BUILD_DIR = '/project'
const DB_DIRECTORY = join(BUILD_DIR, '.netlify', 'db')
const PGLITE_ABORT = 'Failed to start Netlify Database locally: RuntimeError: Aborted().'

const CONNECTION_STRING = 'postgres://localhost:5432/postgres'

// Mirrors NetlifyDev.start(): it logs any failure as a warning and only
// persists `dbConnectionString` when the database actually came up.
const mockStartup = ({ warning, succeeds }: { warning?: string; succeeds: boolean }) => {
  mockStart.mockImplementation(() => {
    if (warning !== undefined) {
      capturedOptions.at(-1)?.logger?.warn(warning)
    }
    if (succeeds) {
      localState.set('dbConnectionString', CONNECTION_STRING)
    }
    return Promise.resolve()
  })
}

describe('connectRawClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions.length = 0
    warnMessages.length = 0
    localState.clear()
    delete process.env.NETLIFY_DB_URL
    mockStart.mockResolvedValue(undefined)
    mockStop.mockResolvedValue(undefined)
  })

  describe('when the local database fails to start', () => {
    beforeEach(() => {
      mockStartup({ warning: PGLITE_ABORT, succeeds: false })
    })

    test('throws a LocalDatabaseStartError carrying the data directory', async () => {
      await expect(connectRawClient(BUILD_DIR)).rejects.toBeInstanceOf(LocalDatabaseStartError)
      await expect(connectRawClient(BUILD_DIR)).rejects.toMatchObject({ directory: DB_DIRECTORY })
    })

    test('reports the underlying startup error instead of a generic message', async () => {
      await expect(connectRawClient(BUILD_DIR)).rejects.toThrow(PGLITE_ABORT)
    })

    test('points the user at the reset command', async () => {
      await expect(connectRawClient(BUILD_DIR)).rejects.toThrow('netlify database reset')
    })

    test('stops the dev instance it started', async () => {
      await expect(connectRawClient(BUILD_DIR)).rejects.toThrow(LocalDatabaseStartError)
      expect(mockStop).toHaveBeenCalledOnce()
    })
  })

  test('forwards startup warnings to the user when the database starts', async () => {
    const unrelatedWarning = 'Failed to reload config: boom'
    mockStartup({ warning: unrelatedWarning, succeeds: true })

    const { connectionString } = await connectRawClient(BUILD_DIR)

    expect(connectionString).toBe(CONNECTION_STRING)
    expect(warnMessages).toEqual([unrelatedWarning])
  })
})

describe('getLocalDatabaseDirectory', () => {
  test('resolves the persisted database directory inside the project', () => {
    expect(getLocalDatabaseDirectory(BUILD_DIR)).toBe(DB_DIRECTORY)
  })
})
