import type { FieldDef, QueryResult } from 'pg'

import { beforeEach, describe, expect, test, vi } from 'vitest'

const { mockQuery, mockCleanup, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockQuery = vi.fn()
  const mockCleanup = vi.fn().mockResolvedValue(undefined)
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockQuery, mockCleanup, logMessages, jsonMessages }
})

vi.mock('../../../../src/commands/database/util/db-connection.js', () => ({
  connectRawClient: vi.fn().mockImplementation(() =>
    Promise.resolve({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      client: { query: (...args: unknown[]) => mockQuery(...args) },
      connectionString: 'postgres://user:pw@localhost:5432/postgres',
      cleanup: mockCleanup,
    }),
  ),
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

import { connect } from '../../../../src/commands/database/db-connect.js'

const makeField = (name: string): FieldDef => ({
  name,
  tableID: 0,
  columnID: 0,
  dataTypeID: 23,
  dataTypeSize: 4,
  dataTypeModifier: -1,
  format: 'text',
})

const makeResult = (
  overrides: Partial<QueryResult<Record<string, unknown>>> & { command: string },
): QueryResult<Record<string, unknown>> => ({ fields: [], rows: [], rowCount: null, oid: 0, ...overrides })

// pg resolves a multi-statement simple query to one result per statement.
const TRANSACTION_RESULTS = [
  makeResult({ command: 'BEGIN' }),
  makeResult({ command: 'SELECT', fields: [makeField('value')], rows: [{ value: 1 }], rowCount: 1 }),
  makeResult({ command: 'COMMIT' }),
]

const createMockCommand = () =>
  ({
    project: { root: '/project', baseDirectory: undefined },
    netlify: { site: { root: '/project' }, config: {} },
  }) as unknown as Parameters<typeof connect>[1]

const TRANSACTION_QUERY = 'BEGIN; SELECT 1 AS value; COMMIT;'

describe('connect --query', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    mockCleanup.mockResolvedValue(undefined)
  })

  test('renders every statement of a transaction instead of throwing', async () => {
    mockQuery.mockResolvedValue(TRANSACTION_RESULTS)

    await connect({ query: TRANSACTION_QUERY }, createMockCommand())

    expect(logMessages.join('\n')).toContain(['BEGIN', ' value ', '-------', ' 1     ', '(1 row)', 'COMMIT'].join('\n'))
    expect(mockCleanup).toHaveBeenCalledOnce()
  })

  test('outputs the rows of the transaction as JSON with --json', async () => {
    mockQuery.mockResolvedValue(TRANSACTION_RESULTS)

    await connect({ query: TRANSACTION_QUERY, json: true }, createMockCommand())

    expect(jsonMessages).toEqual([[{ value: 1 }]])
  })

  test('renders a single-statement query', async () => {
    mockQuery.mockResolvedValue(TRANSACTION_RESULTS[1])

    await connect({ query: 'SELECT 1 AS value;' }, createMockCommand())

    expect(logMessages.join('\n')).toContain([' value ', '-------', ' 1     ', '(1 row)'].join('\n'))
  })

  test('redacts credentials from the logged connection string', async () => {
    mockQuery.mockResolvedValue(TRANSACTION_RESULTS[1])

    await connect({ query: 'SELECT 1 AS value;' }, createMockCommand())

    expect(logMessages[0]).toBe('Connected to postgres://localhost:5432/postgres')
  })
})
