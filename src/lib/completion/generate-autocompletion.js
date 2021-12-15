// @ts-check
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname } from 'path'

import { sortOptions } from '../../utils/index.js'

import { AUTOCOMPLETION_FILE } from './constants.js'

/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command').BaseCommand} program
 * @returns {void}
 */
export const createAutocompletion = (program) => {
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
}
