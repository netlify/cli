import { resolve } from 'node:path'

import inquirer from 'inquirer'
import semver from 'semver'

import type { RunRecipeOptions } from '../../commands/recipes/recipes.js'
import { ansis, logAndThrowError, log, version } from '../../utils/command-helpers.js'

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

const presets = [
  { name: 'Cursor rules (.cursor/rules/)', value: '.cursor/rules' },
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

export const run = async ({ args, command }: RunRecipeOptions) => {
  // Start the download in the background while we wait for the prompts.
  const download = downloadFile(version).catch(() => null)

  const filePath = args[0] || (await promptForPath())
  const { contents: downloadedFile, minimumCLIVersion } = (await download) ?? {}

  if (!downloadedFile) {
    return logAndThrowError('An error occurred when pulling the latest context files. Please try again.')
  }

  if (minimumCLIVersion && semver.lt(version, minimumCLIVersion)) {
    return logAndThrowError(
      `This command requires version ${minimumCLIVersion} or above of the Netlify CLI. Refer to ${ansis.underline(
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
          `You're all up to date! ${ansis.underline(
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
        message: `A context file already exists at ${ansis.underline(
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

  log(`${existing ? 'Updated' : 'Created'} context files at ${ansis.underline(absoluteFilePath)}`)
}
