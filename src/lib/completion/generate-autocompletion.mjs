// @ts-check
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

import { sortOptions, warn } from '../../utils/command-helpers.mjs'

import { AUTOCOMPLETION_FILE } from './constants.mjs'

/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command.mjs').default} program
 * @returns {void}
 */
const generateAutocompletion = (program) => {
  try {
    const autocomplete = program.commands.reduce(
      (prev, cmd) => ({
        ...prev,
        [cmd.name()]: {
          name: cmd.name(),
          description: cmd.description().split('\n')[0],
          options: cmd.options
            .filter((option) => !option.hidden)
            .sort(sortOptions)
            .map((opt) => ({ name: `--${opt.name()}`, description: opt.description })),
        },
      }),
      {},
    )

    if (!existsSync(dirname(AUTOCOMPLETION_FILE))) {
      mkdirSync(dirname(AUTOCOMPLETION_FILE), { recursive: true })
    }
    writeFileSync(AUTOCOMPLETION_FILE, JSON.stringify(autocomplete), 'utf-8')
  } catch (error_) {
    // Sometimes it can happen that the autocomplete generation in the postinstall script lacks permissions
    // to write files to the home directory of the user. Therefore just warn with the error and don't break install.
    if (error_ instanceof Error) {
      warn(`could not create autocompletion.\n${error_.message}`)
    }
  }
}

export default generateAutocompletion
