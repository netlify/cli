import { resetDatabase } from '@netlify/db-dev'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { connectToDatabase } from './db-connection.js'

export interface ResetOptions {
  json?: boolean
}

export const reset = async (options: ResetOptions, command: BaseCommand) => {
  const { json } = options
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const { executor, cleanup } = await connectToDatabase(buildDir)

  try {
    await resetDatabase(executor)

    if (json) {
      logJson({ reset: true })
    } else {
      log('Local development database has been reset.')
    }
  } finally {
    await cleanup()
  }
}
