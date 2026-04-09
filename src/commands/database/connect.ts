import readline from 'readline'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { connectRawClient } from './db-connection.js'
import { executeMetaCommand } from './meta-commands.js'
import { formatQueryResult } from './psql-formatter.js'

export interface ConnectOptions {
  query?: string
  json?: boolean
}

function redactConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    url.username = ''
    url.password = ''
    return url.toString()
  } catch {
    throw new Error('The connection string is not a valid URL.')
  }
}

export const connect = async (options: ConnectOptions, command: BaseCommand): Promise<void> => {
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const { client, connectionString, cleanup } = await connectRawClient(buildDir)

  // --json without --query: print connection details
  if (options.json && !options.query) {
    logJson({ connection_string: connectionString, context: 'dev' })
    await cleanup()
    return
  }

  log(`Connected to ${redactConnectionString(connectionString)}`)

  // --query: one-shot mode
  if (options.query) {
    try {
      const result = await client.query<Record<string, unknown>>(options.query)
      if (options.json) {
        logJson(result.rows)
      } else {
        log(formatQueryResult(result.fields, result.rows, result.rowCount, result.command))
      }
    } finally {
      await cleanup()
    }
    return
  }

  // Interactive REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'netlifydb=> ',
  })

  let buffer = ''

  const handleCleanup = async () => {
    rl.close()
    await cleanup()
  }

  process.on('SIGINT', () => {
    if (buffer) {
      // Cancel current multi-line input
      buffer = ''
      process.stdout.write('\n')
      rl.setPrompt('netlifydb=> ')
      rl.prompt()
    } else {
      log('')
      void handleCleanup()
    }
  })

  rl.on('close', () => {
    void handleCleanup()
  })

  rl.on('line', (line: string) => {
    // Meta-commands are only recognized at the start of input (not mid-statement)
    if (buffer === '' && line.trimStart().startsWith('\\')) {
      rl.pause()
      void (async () => {
        try {
          const result = await executeMetaCommand(line, client)
          switch (result.type) {
            case 'quit':
              await handleCleanup()
              return
            case 'help':
              log(result.text)
              break
            case 'unknown':
              log(`Invalid command ${result.command}. Try \\? for help.`)
              break
            case 'query':
              log(formatQueryResult(result.fields, result.rows, result.rowCount, result.command))
              break
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log(`ERROR:  ${message}`)
        }
        rl.resume()
        rl.prompt()
      })()
      return
    }

    buffer += (buffer ? '\n' : '') + line

    if (buffer.trimEnd().endsWith(';')) {
      const sql = buffer
      buffer = ''
      rl.setPrompt('netlifydb=> ')
      rl.pause()
      void (async () => {
        try {
          const result = await client.query<Record<string, unknown>>(sql)
          log(formatQueryResult(result.fields, result.rows, result.rowCount, result.command))
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          log(`ERROR:  ${message}`)
        }
        rl.resume()
        rl.prompt()
      })()
    } else {
      rl.setPrompt('netlifydb-> ')
      rl.prompt()
    }
  })

  rl.prompt()
}
