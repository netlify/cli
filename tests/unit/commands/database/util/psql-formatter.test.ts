import type { FieldDef, QueryResult } from 'pg'

import { describe, expect, test } from 'vitest'

import {
  formatQueryResult,
  formatStatementResults,
  lastRowSet,
} from '../../../../../src/commands/database/util/psql-formatter.js'

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
): QueryResult<Record<string, unknown>> => ({
  fields: [],
  rows: [],
  rowCount: null,
  oid: 0,
  ...overrides,
})

const BEGIN = makeResult({ command: 'BEGIN' })
const COMMIT = makeResult({ command: 'COMMIT' })
const SELECT_ONE = makeResult({
  command: 'SELECT',
  fields: [makeField('value')],
  rows: [{ value: 1 }],
  rowCount: 1,
})
const INSERT_TWO = makeResult({ command: 'INSERT', rowCount: 2 })

const SELECT_ONE_BLOCK = [' value ', '-------', ' 1     ', '(1 row)'].join('\n')

describe('formatStatementResults', () => {
  test('formats a bare result from a single-statement query', () => {
    expect(formatStatementResults(SELECT_ONE)).toBe(SELECT_ONE_BLOCK)
  })

  test('formats one block per statement for a multi-statement transaction', () => {
    expect(formatStatementResults([BEGIN, SELECT_ONE, COMMIT])).toBe(`BEGIN\n${SELECT_ONE_BLOCK}\nCOMMIT`)
  })

  test('formats a multi-statement query whose final statement returns no rows', () => {
    expect(formatStatementResults([BEGIN, INSERT_TWO, COMMIT])).toBe('BEGIN\nINSERT 0 2\nCOMMIT')
  })

  test('formats an empty result list as an empty string', () => {
    expect(formatStatementResults([])).toBe('')
  })
})

describe('lastRowSet', () => {
  test('returns the rows of a single-statement query', () => {
    expect(lastRowSet(SELECT_ONE)).toEqual([{ value: 1 }])
  })

  test('returns the rows of the last row-returning statement, ignoring the trailing COMMIT', () => {
    expect(lastRowSet([BEGIN, SELECT_ONE, COMMIT])).toEqual([{ value: 1 }])
  })

  test('returns the last row set when several statements return rows', () => {
    const other = makeResult({ command: 'SELECT', fields: [makeField('other')], rows: [{ other: 2 }], rowCount: 1 })
    expect(lastRowSet([SELECT_ONE, other])).toEqual([{ other: 2 }])
  })

  test('returns an empty array when no statement returned a row set', () => {
    expect(lastRowSet([BEGIN, INSERT_TWO, COMMIT])).toEqual([])
  })
})

describe('formatQueryResult', () => {
  test('reports the command tag for a statement with no row set', () => {
    expect(formatQueryResult([], [], null, 'COMMIT')).toBe('COMMIT')
  })
})
