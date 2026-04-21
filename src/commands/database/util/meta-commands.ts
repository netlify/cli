import type { Client, FieldDef } from 'pg'

export type MetaCommandResult =
  | { type: 'query'; fields: FieldDef[]; rows: Record<string, unknown>[]; rowCount: number | null; command: string }
  | { type: 'quit' }
  | { type: 'help'; text: string }
  | { type: 'unknown'; command: string }

const HELP_TEXT = `Netlify Database interactive client. Supports a subset of psql commands.

General
  \\q          quit

Informational
  \\d          list tables
  \\dt         list tables
  \\d NAME     describe table
  \\l          list databases
  \\?          show this help`

export const executeMetaCommand = async (input: string, client: Client): Promise<MetaCommandResult> => {
  const trimmed = input.trim()
  const [cmd, ...args] = trimmed.split(/\s+/)

  if (cmd === '\\q') {
    return { type: 'quit' }
  }

  if (cmd === '\\?') {
    return { type: 'help', text: HELP_TEXT }
  }

  if (cmd === '\\dt' || (cmd === '\\d' && args.length === 0)) {
    const result = await client.query<Record<string, unknown>>(
      `SELECT schemaname AS "Schema", tablename AS "Name", tableowner AS "Owner"
       FROM pg_tables
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
       ORDER BY schemaname, tablename`,
    )
    return { type: 'query', fields: result.fields, rows: result.rows, rowCount: result.rowCount, command: 'SELECT' }
  }

  if (cmd === '\\d' && args.length > 0) {
    const tableName = args[0]
    const result = await client.query<Record<string, unknown>>(
      `SELECT column_name AS "Column", data_type AS "Type",
              CASE WHEN is_nullable = 'YES' THEN 'yes' ELSE 'no' END AS "Nullable",
              column_default AS "Default"
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName],
    )
    if (result.rowCount === 0) {
      return { type: 'query', fields: result.fields, rows: result.rows, rowCount: 0, command: 'SELECT' }
    }
    return { type: 'query', fields: result.fields, rows: result.rows, rowCount: result.rowCount, command: 'SELECT' }
  }

  if (cmd === '\\l') {
    const result = await client.query<Record<string, unknown>>(
      `SELECT datname AS "Name",
              pg_catalog.pg_get_userbyid(datdba) AS "Owner",
              pg_catalog.pg_encoding_to_char(encoding) AS "Encoding"
       FROM pg_catalog.pg_database
       ORDER BY 1`,
    )
    return { type: 'query', fields: result.fields, rows: result.rows, rowCount: result.rowCount, command: 'SELECT' }
  }

  return { type: 'unknown', command: cmd }
}
