import fs from 'fs'
import { dirname } from 'path'

import type { Command } from 'commander'

import { compareOptions, warn } from '../../utils/command-helpers.js'

import { AUTOCOMPLETION_FILE } from './constants.js'

/**
 * Create or updates the autocompletion information for the CLI
 */
const generateAutocompletion = (program: Command) => {
  try {
    const autocomplete = program.commands.reduce(
      (prev, cmd) => ({
        ...prev,
        [cmd.name()]: {
          name: cmd.name(),
          description: cmd.description().split('\n')[0],
          options: cmd.options
            .filter((option) => !option.hidden)
            .sort(compareOptions)
            .map((opt) => ({ name: `--${opt.name()}`, description: opt.description })),
        },
      }),
      {},
    )

    if (!fs.existsSync(dirname(AUTOCOMPLETION_FILE))) {
      fs.mkdirSync(dirname(AUTOCOMPLETION_FILE), { recursive: true })
    }
    fs.writeFileSync(AUTOCOMPLETION_FILE, JSON.stringify(autocomplete), 'utf-8')
  } catch (error_) {
    // Sometimes it can happen that the autocomplete generation in the postinstall script lacks permissions
    // to write files to the home directory of the user. Therefore just warn with the error and don't break install.
    if (error_ instanceof Error) {
      warn(`could not create autocompletion.\n${error_.message}`)
    }
  }
}

export default generateAutocompletion
