import { resolve } from 'node:path'

import inquirer from 'inquirer'
import execa from 'execa'

import type { RunRecipeOptions } from '../../commands/recipes/recipes.js'
import { logAndThrowError, log, version } from '../../utils/command-helpers.js'

import {
  getExistingContext,
  NTL_DEV_MCP_FILE_NAME,
  getContextConsumers,
  ConsumerConfig,
  deleteFile,
  downloadAndWriteContextFiles,
} from './context.js'

export const description = 'Manage context files for AI tools'

// context consumers endpoints returns all supported IDE and other consumers
// that can be used to pull context files. It also includes a catchall consumer
// for outlining all context that an unspecified consumer would handle.
const allContextConsumers = await getContextConsumers(version)
const cliContextConsumers = allContextConsumers.filter((consumer) => !consumer.hideFromCLI)

const rulesForDefaultConsumer = allContextConsumers.find((consumer) => consumer.key === 'catchall-consumer') ?? {
  key: 'catchall-consumer',
  path: './ai-context',
  presentedName: '',
  ext: 'mdc',
  contextScopes: {},
  hideFromCLI: true,
}

const presets = cliContextConsumers.map((consumer) => ({
  name: consumer.presentedName,
  value: consumer.key,
}))

// always add the custom location option (not preset from API)
presets.push({ name: 'Custom location', value: rulesForDefaultConsumer.key })

const promptForContextConsumerSelection = async (): Promise<ConsumerConfig> => {
  const { consumerKey } = await inquirer.prompt([
    {
      name: 'consumerKey',
      message: 'Where should we put the context files?',
      type: 'list',
      choices: presets,
    },
  ])

  const contextConsumer = consumerKey ? cliContextConsumers.find((consumer) => consumer.key === consumerKey) : null
  if (contextConsumer) {
    return contextConsumer
  }

  const { customPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'customPath',
      message: 'Enter the path, relative to the project root, where the context files should be placed',
      default: './ai-context',
    },
  ])

  if (customPath) {
    return { ...rulesForDefaultConsumer, path: customPath || rulesForDefaultConsumer.path }
  }

  log('You must select a path.')

  return promptForContextConsumerSelection()
}

/**
 * Checks if a command belongs to a known IDEs by checking if it includes a specific string.
 * For example, the command that starts windsurf looks something like "/applications/windsurf.app/contents/...".
 */
export const getConsumerKeyFromCommand = (command: string): string | null => {
  // The actual command is something like "/applications/windsurf.app/contents/...", but we are only looking for windsurf
  const match = cliContextConsumers.find(
    (consumer) => consumer.consumerProcessCmd && command.includes(consumer.consumerProcessCmd),
  )
  return match ? match.key : null
}

/**
 * Receives a process ID (pid) and returns both the command that the process was run with and its parent process ID. If the process is a known IDE, also returns information about that IDE.
 */
export const getCommandAndParentPID = async (
  pid: number,
): Promise<{
  parentPID: number
  command: string
  consumerKey: string | null
}> => {
  const { stdout } = await execa('ps', ['-p', String(pid), '-o', 'ppid=,comm='])
  const output = stdout.trim()
  const spaceIndex = output.indexOf(' ')
  const parentPID = output.substring(0, spaceIndex)
  const command = output.substring(spaceIndex + 1).toLowerCase()
  return {
    parentPID: Number(parentPID),
    command,
    consumerKey: getConsumerKeyFromCommand(command),
  }
}

/**
 * Detects the IDE by walking up the process tree and matching against known consumer processes
 */
export const detectIDE = async (): Promise<ConsumerConfig | null> => {
  // Go up the chain of ancestor process IDs and find if one of their commands matches an IDE.
  const ppid = process.ppid
  let result: Awaited<ReturnType<typeof getCommandAndParentPID>>
  try {
    result = await getCommandAndParentPID(ppid)
    while (result.parentPID !== 1 && !result.consumerKey) {
      result = await getCommandAndParentPID(result.parentPID)
    }
  } catch {
    // The command "ps -p {pid} -o ppid=,comm=" didn't work,
    // perhaps we are on a machine that doesn't support it.
    return null
  }

  if (result?.consumerKey) {
    const contextConsumer = cliContextConsumers.find((consumer) => consumer.key === result.consumerKey)
    if (contextConsumer) {
      return contextConsumer
    }
  }

  return null
}

export const run = async (runOptions: RunRecipeOptions) => {
  const { args, command } = runOptions
  let consumer: ConsumerConfig | null = null
  const filePath: string | null = args[0]

  if (filePath) {
    consumer = { ...rulesForDefaultConsumer, path: filePath }
  }

  if (!consumer && process.env.AI_CONTEXT_SKIP_DETECTION !== 'true') {
    consumer = await detectIDE()
  }

  if (!consumer) {
    consumer = await promptForContextConsumerSelection()
  }

  if (!consumer?.contextScopes) {
    log(
      'No context files found for this consumer. Try again or let us know if this happens again via our support channels.',
    )
    return
  }

  try {
    await downloadAndWriteContextFiles(consumer, runOptions)

    // the deprecated MCP file path
    // let's remove that file if it exists.
    const priorContextFilePath = resolve(command?.workingDir ?? '', consumer.path, NTL_DEV_MCP_FILE_NAME)
    const priorExists = await getExistingContext(priorContextFilePath)
    if (priorExists) {
      await deleteFile(priorContextFilePath)
    }

    log('All context files have been added!')
  } catch (error) {
    logAndThrowError(error)
  }
}
