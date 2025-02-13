import { resolve } from 'node:path'

import inquirer from 'inquirer'
import semver from 'semver'

import type { RunRecipeOptions } from '../../commands/recipes/recipes.js'
import { chalk, error, log, version } from '../../utils/command-helpers.js'

import {
  applyOverrides,
  downloadFile,
  getExistingContext,
  parseContextFile,
  writeFile,
  NETLIFY_PROVIDER,
} from './context.js'

export const description = 'Create and update context files for AI tools'

const toolOptions = [
  { name: 'Cursor', value: 'cursor' },
  { name: 'Other', value: '' },
]

const TOOLS = {
  cursor: '.cursor/rules/netlify_development_rules.mdc',
}

export const run = async ({ args, command }: RunRecipeOptions) => {
  // Start the download in the background while we wait for the prompts.
  // eslint-disable-next-line promise/prefer-await-to-then
  const download = downloadFile(version).catch(() => null)

  let [tool] = args

  if (!tool) {
    const { selectedTool } = await inquirer.prompt([
      {
        name: 'selectedTool',
        message: "Select the AI tool you're working with",
        type: 'list',
        choices: toolOptions,
      },
    ])

    tool = selectedTool
  }

  let filePath = TOOLS[tool as keyof typeof TOOLS]

  if (!filePath) {
    const { selectedPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'selectedPath',
        message: 'Enter the path, relative to the project root, where the context files should be placed',
        default: './ai-context/netlify_development_rules.mdc',
      },
    ])

    filePath = selectedPath
  }

  const { contents: downloadedFile, minimumCLIVersion } = (await download) ?? {}

  if (!downloadedFile) {
    error('An error occurred when pulling the latest context files. Please try again.')

    return
  }

  if (minimumCLIVersion && semver.lt(version, minimumCLIVersion)) {
    error(
      `This command requires version ${minimumCLIVersion} or above of the Netlify CLI. Refer to ${chalk.underline(
        'https://ntl.fyi/update-cli',
      )} for information on how to update.`,
    )

    return
  }

  const absoluteFilePath = resolve(command?.workingDir ?? '', filePath)
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
