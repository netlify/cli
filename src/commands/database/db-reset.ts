import { rm } from 'fs/promises'

import inquirer from 'inquirer'

import { resetDatabase } from '@netlify/dev'

import { log, logJson } from '../../utils/command-helpers.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import BaseCommand from '../base-command.js'
import { connectToDatabase, LocalDatabaseStartError } from './util/db-connection.js'

export interface ResetOptions {
  force?: boolean
  json?: boolean
}

const discardLocalDatabase = async (error: LocalDatabaseStartError, options: ResetOptions) => {
  const { directory } = error
  const { force, json } = options

  if (!force) {
    if (json || !isInteractive()) {
      throw new Error(`${error.summary}\nRe-run with --force to delete ${directory} and start from an empty database.`)
    }

    log(error.summary)

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Delete ${directory} and start from an empty database?`,
        default: false,
      },
    ])

    if (!confirmed) {
      log('Reset cancelled.')
      return
    }
  }

  await rm(directory, { recursive: true, force: true })

  if (json) {
    logJson({ reset: true, discarded: true })
  } else {
    log(`Deleted ${directory}. An empty database will be created the next time the project starts.`)
  }
}

export const reset = async (options: ResetOptions, command: BaseCommand) => {
  const { json } = options
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  let connection
  try {
    connection = await connectToDatabase(buildDir)
  } catch (error) {
    if (!(error instanceof LocalDatabaseStartError)) {
      throw error
    }
    await discardLocalDatabase(error, options)
    return
  }

  const { executor, cleanup } = connection

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
