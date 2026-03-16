import { LocalState } from '@netlify/dev-utils'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export interface ConnectionStringOptions {
  json?: boolean
}

export const connectionString = (options: ConnectionStringOptions, command: BaseCommand) => {
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const state = new LocalState(buildDir)
  const dbConnectionString = state.get('dbConnectionString')

  if (!dbConnectionString) {
    if (options.json) {
      logJson({ connection_string: null, error: 'No active local database found. Start one with `netlify dev`.' })
    } else {
      log('No active local database found. Start one with `netlify dev`.')
    }
    return
  }

  if (options.json) {
    logJson({ connection_string: dbConnectionString })
  } else {
    log(dbConnectionString)
  }
}
