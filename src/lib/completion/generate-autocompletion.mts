// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'existsSync... Remove this comment to see the full error message
const { existsSync, mkdirSync, writeFileSync } = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dirname'.
const { dirname } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'sortOption... Remove this comment to see the full error message
const { sortOptions, warn } = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AUTOCOMPLE... Remove this comment to see the full error message
const { AUTOCOMPLETION_FILE } = require('./constants.cjs')

/**
 * Create or updates the autocompletion information for the CLI
 * @param {import('../../commands/base-command').BaseCommand} program
 * @returns {void}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAuto... Remove this comment to see the full error message
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
            // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
            .filter((option: $TSFixMe) => !option.hidden)
            .sort(sortOptions)
            // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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

module.exports = { createAutocompletion }
