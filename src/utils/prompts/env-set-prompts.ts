import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

export const generateSetMessage = (variableName: string) => ({
  warningMessage: `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(
    variableName,
  )} already exists!`,
  noticeMessage: `${chalk.yellowBright(
    'Notice',
  )}: To overwrite the existing variable without confirmation, pass the -f or --force flag.`,
  confirmMessage: 'The environment variable already exists. Do you want to overwrite it?',
})

/**
 * Generates warning, notice and confirm messages when trying to set an env variable
 * that already exists.
 *
 * @param {string} key - The key of the environment variable that already exists
 * @returns {Object} An object with the following properties:
 *   - warning: A warning message to be displayed to the user
 *   - notice: A notice message to be displayed to the user
 *   - confirm: A confirmation prompt to ask the user if they want to overwrite the existing variable
 */
export const promptOverwriteEnvVariable = async (key: string): Promise<void> => {
  const { confirmMessage, noticeMessage, warningMessage } = generateSetMessage(key)

  log()
  log(warningMessage)
  log()
  log(noticeMessage)
  log()
  await confirmPrompt(confirmMessage)
}
