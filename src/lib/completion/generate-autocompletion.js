// @ts-check
const { existsSync, mkdirSync, writeFileSync } = require('fs')
const { dirname } = require('path')

const { sortOptions } = require('../../utils')

const { AUTOCOMPLETION_FILE } = require('./constants')

/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command').BaseCommand} program
 * @returns {void}
 */
const createAutocompletion = (program) => {
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

module.exports = { createAutocompletion }
