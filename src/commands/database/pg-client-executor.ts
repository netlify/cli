import type { Client, QueryResultRow } from 'pg'

import type { SQLExecutor } from '@netlify/db-dev'

export class PgClientExecutor implements SQLExecutor {
  #client: Client

  constructor(client: Client) {
    this.#client = client
  }

  async exec(sql: string): Promise<void> {
    await this.#client.query(sql)
  }

  async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
    const result = await this.#client.query<T & QueryResultRow>(sql, params)
    return { rows: result.rows }
  }

  async transaction<T>(fn: (tx: SQLExecutor) => Promise<T>): Promise<T> {
    await this.#client.query('BEGIN')
    try {
      const result = await fn(this)
      await this.#client.query('COMMIT')
      return result
    } catch (error) {
      await this.#client.query('ROLLBACK')
      throw error
    }
  }
}
