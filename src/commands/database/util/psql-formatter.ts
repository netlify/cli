import type { FieldDef, QueryResult } from 'pg'

type StatementResult = QueryResult<Record<string, unknown>>

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    return value
  }
  // TODO(serhalp): Narrow this to the numbers, bigints, and booleans that actually reach here.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value)
}

export const formatQueryResult = (
  fields: FieldDef[],
  rows: Record<string, unknown>[],
  rowCount: number | null,
  command: string,
): string => {
  if (fields.length === 0) {
    // DDL or DML without returning clause
    if (command === 'INSERT') {
      return `INSERT 0 ${String(rowCount ?? 0)}`
    }
    if (command === 'UPDATE' || command === 'DELETE') {
      return `${command} ${String(rowCount ?? 0)}`
    }
    return command
  }

  const headers = fields.map((f) => f.name)

  const stringRows = rows.map((row) => headers.map((h) => formatValue(row[h])))

  const widths = headers.map((header, i) => {
    const maxDataWidth = stringRows.reduce((max, row) => Math.max(max, row[i].length), 0)
    return Math.max(header.length, maxDataWidth)
  })

  const lines: string[] = []

  // Header
  lines.push(headers.map((h, i) => ` ${h.padEnd(widths[i])} `).join('|'))

  // Separator
  lines.push(widths.map((w) => '-'.repeat(w + 2)).join('+'))

  // Rows
  for (const row of stringRows) {
    lines.push(row.map((val, i) => ` ${val.padEnd(widths[i])} `).join('|'))
  }

  // Footer
  const count = rowCount ?? rows.length
  lines.push(`(${String(count)} ${count === 1 ? 'row' : 'rows'})`)

  return lines.join('\n')
}

// pg resolves a simple query to one `Result` per statement when the SQL holds
// more than one statement, and to a bare `Result` when it holds exactly one.
const toStatementResults = (result: StatementResult | StatementResult[]): StatementResult[] =>
  Array.isArray(result) ? result : [result]

export const formatStatementResults = (result: StatementResult | StatementResult[]): string =>
  toStatementResults(result)
    .map(({ fields, rows, rowCount, command }) => formatQueryResult(fields, rows, rowCount, command))
    .join('\n')

// Rows to emit for `--json`: those of the last statement that returned a row
// set, so a scripted `BEGIN; SELECT ...; COMMIT;` yields the SELECT's rows
// rather than COMMIT's empty one. Always an array, whatever the statement count.
export const lastRowSet = (result: StatementResult | StatementResult[]): Record<string, unknown>[] =>
  toStatementResults(result).findLast(({ fields }) => fields.length > 0)?.rows ?? []
