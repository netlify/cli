import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockGet, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockGet, logMessages, jsonMessages }
})

vi.mock('@netlify/dev-utils', () => ({
  LocalState: vi.fn().mockImplementation(() => ({
    get: mockGet,
  })),
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

import { connectionString } from '../../../../src/commands/database/connection-string.js'

function createMockCommand(overrides: { buildDir?: string; projectRoot?: string } = {}) {
  const { buildDir = '/project', projectRoot = '/project' } = overrides

  return {
    project: { root: projectRoot, baseDirectory: undefined },
    netlify: { site: { root: buildDir } },
  } as unknown as Parameters<typeof connectionString>[1]
}

describe('connectionString', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
  })

  test('prints connection string when local database is active', () => {
    mockGet.mockReturnValue('postgresql://localhost:5432/testdb')

    connectionString({}, createMockCommand())

    expect(mockGet).toHaveBeenCalledWith('dbConnectionString')
    expect(logMessages).toEqual(['postgresql://localhost:5432/testdb'])
  })

  test('prints message when no active local database is found', () => {
    mockGet.mockReturnValue(undefined)

    connectionString({}, createMockCommand())

    expect(logMessages).toEqual(['No active local database found. Start one with `netlify dev`.'])
  })

  test('outputs JSON with connection string when --json flag is set', () => {
    mockGet.mockReturnValue('postgresql://localhost:5432/testdb')

    connectionString({ json: true }, createMockCommand())

    expect(jsonMessages).toEqual([{ connection_string: 'postgresql://localhost:5432/testdb' }])
    expect(logMessages).toHaveLength(0)
  })

  test('outputs JSON with null and error when no database and --json flag is set', () => {
    mockGet.mockReturnValue(undefined)

    connectionString({ json: true }, createMockCommand())

    expect(jsonMessages).toEqual([
      { connection_string: null, error: 'No active local database found. Start one with `netlify dev`.' },
    ])
    expect(logMessages).toHaveLength(0)
  })

  test('throws when project root cannot be determined', () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined },
      netlify: { site: { root: undefined } },
    } as unknown as Parameters<typeof connectionString>[1]

    expect(() => {
      connectionString({}, command)
    }).toThrow('Could not determine the project root directory.')
  })
})
