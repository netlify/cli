// @ts-check

const { existsSync, mkdirSync, writeFileSync } = require('fs')

const { dirname } = require('path')


const { sortOptions, warn } = require('../../utils/index.mjs')


const { AUTOCOMPLETION_FILE } = require('./constants.mjs')

/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command').BaseCommand} program
 * @returns {void}
 */

const createAutocompletion = (program: $TSFixMe) => {
  try {
    const autocomplete = program.commands.reduce(
      // @ts-expect-error TS(7006): Parameter 'prev' implicitly has an 'any' type.
      (prev, cmd) => ({
        ...prev,

        [cmd.name()]: {
          name: cmd.name(),
          description: cmd.description().split('\n')[0],
          options: cmd.options
            
            .filter((option: $TSFixMe) => !option.hidden)
            .sort(sortOptions)
            
            .map((opt: $TSFixMe) => ({
            name: `--${opt.name()}`,
            description: opt.description
          })),
        }
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

export default { createAutocompletion }
