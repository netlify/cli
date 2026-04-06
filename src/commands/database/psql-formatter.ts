import type { FieldDef } from 'pg'

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
