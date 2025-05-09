import { resolve } from 'node:path'

import inquirer from 'inquirer'
import semver from 'semver'
import execa from 'execa'

import type { RunRecipeOptions } from '../../commands/recipes/recipes.js'
import { chalk, logAndThrowError, log, version } from '../../utils/command-helpers.js'

import {
  applyOverrides,
  downloadFile,
  getExistingContext,
  parseContextFile,
  writeFile,
  FILE_NAME,
  NETLIFY_PROVIDER,
} from './context.js'

export const description = 'Manage context files for AI tools'

const IDE_RULES_PATH_MAP = {
  windsurf: '.windsurf/rules',
  cursor: '.cursor/rules',
}

const presets = [
  { name: 'Windsurf rules (.windsurf/rules/)', value: IDE_RULES_PATH_MAP.windsurf },
  { name: 'Cursor rules (.cursor/rules/)', value: IDE_RULES_PATH_MAP.cursor },
  { name: 'Custom location', value: '' },
]

const promptForPath = async (): Promise<string> => {
  const { presetPath } = await inquirer.prompt([
    {
      name: 'presetPath',
      message: 'Where should we put the context files?',
      type: 'list',
      choices: presets,
    },
  ])

  if (presetPath) {
    return presetPath
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
    return customPath
  }

  log('You must select a path.')

  return promptForPath()
}

type IDE = {
  name: string
  command: string
  rulesPath: string
}
const IDE: IDE[] = [
  {
    name: 'Windsurf',
    command: 'windsurf',
    rulesPath: IDE_RULES_PATH_MAP.windsurf,
  },
  {
    name: 'Cursor',
    command: 'cursor',
    rulesPath: IDE_RULES_PATH_MAP.cursor,
  },
]

/**
 * Checks if a command belongs to a known IDEs by checking if it includes a specific string.
 * For example, the command that starts windsurf looks something like "/applications/windsurf.app/contents/...".
 */
const getIDEFromCommand = (command: string): IDE | null => {
  // The actual command is something like "/applications/windsurf.app/contents/...", but we are only looking for windsurf
  const match = IDE.find((ide) => command.includes(ide.command))
  return match ?? null
}

/**
 * Receives a process ID (pid) and returns both the command that the process was run with and its parent process ID. If the process is a known IDE, also returns information about that IDE.
 */
const getCommandAndParentPID = async (
  pid: number,
): Promise<{
  parentPID: number
  command: string
  ide: IDE | null
}> => {
  const { stdout } = await execa('ps', ['-p', String(pid), '-o', 'ppid=,comm='])
  const output = stdout.trim()
  const spaceIndex = output.indexOf(' ')
  const parentPID = output.substring(0, spaceIndex)
  const command = output.substring(spaceIndex + 1).toLowerCase()
  return {
    parentPID: parseInt(parentPID, 10),
    command: command,
    ide: getIDEFromCommand(command),
  }
}

const getPathByDetectingIDE = async (): Promise<string | null> => {
  // Go up the chain of ancestor process IDs and find if one of their commands matches an IDE.
  const ppid = process.ppid
  let result: Awaited<ReturnType<typeof getCommandAndParentPID>>
  try {
    result = await getCommandAndParentPID(ppid)
    while (result.parentPID !== 1 && !result.ide) {
      result = await getCommandAndParentPID(result.parentPID)
    }
  } catch {
    // The command "ps -p {pid} -o ppid=,comm=" didn't work,
    // perhaps we are on a machine that doesn't support it.
    return null
  }
  return result.ide ? result.ide.rulesPath : null
}

export const run = async ({ args, command, options }: RunRecipeOptions) => {
  // Start the download in the background while we wait for the prompts.
  const download = downloadFile(version).catch(() => null)

  const filePath =
    args[0] || ((options?.skipDetection ? null : await getPathByDetectingIDE()) ?? (await promptForPath()))
  const { contents: downloadedFile, minimumCLIVersion } = (await download) ?? {}

  if (!downloadedFile) {
    return logAndThrowError('An error occurred when pulling the latest context files. Please try again.')
  }

  if (minimumCLIVersion && semver.lt(version, minimumCLIVersion)) {
    return logAndThrowError(
      `This command requires version ${minimumCLIVersion} or above of the Netlify CLI. Refer to ${chalk.underline(
        'https://ntl.fyi/update-cli',
      )} for information on how to update.`,
    )
  }

  const absoluteFilePath = resolve(command?.workingDir ?? '', filePath, FILE_NAME)
  const existing = await getExistingContext(absoluteFilePath)
  const remote = parseContextFile(downloadedFile)

  let { contents } = remote

  // Does a file already exist at this path?
  if (existing) {
    // If it's a file we've created, let's check the version and bail if we're
    // already on the latest, otherwise rewrite it with the latest version.
    if (existing.provider?.toLowerCase() === NETLIFY_PROVIDER) {
      if (remote?.version === existing.version) {
        log(
          `You're all up to date! ${chalk.underline(
            absoluteFilePath,
          )} contains the latest version of the context files.`,
        )

        return
      }

      // We must preserve any overrides found in the existing file.
      contents = applyOverrides(remote.contents, existing.overrides?.innerContents)
    } else {
      // If this is not a file we've created, we can offer to overwrite it and
      // preserve the existing contents by moving it to the overrides slot.
      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `A context file already exists at ${chalk.underline(
          absoluteFilePath,
        )}. It has not been created by the Netlify CLI, but we can update it while preserving its existing content. Can we proceed?`,
        default: true,
      })

      if (!confirm) {
        return
      }

      // Whatever exists in the file goes in the overrides block.
      contents = applyOverrides(remote.contents, existing.contents)
    }
  }

  await writeFile(absoluteFilePath, contents)

  log(`${existing ? 'Updated' : 'Created'} context files at ${chalk.underline(absoluteFilePath)}`)
}
