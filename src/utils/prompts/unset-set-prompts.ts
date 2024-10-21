import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

export const generateUnsetMessage = (variableName: string) => ({
  warningMessage: `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(
    variableName,
  )} already exists!`,
  noticeMessage: `${chalk.yellowBright(
    'Notice',
  )}: To overwrite the existing variable without confirmation, pass the -f or --force flag.`,
  confirmMessage: 'The environment variable already exists. Do you want to overwrite it?',
})

/**
 * Logs a warning and prompts user to confirm overwriting an existing environment variable
 *
 * @param {string} key - The key of the environment variable that already exists
 * @returns {Promise<void>} A promise that resolves when the user has confirmed overwriting the variable
 */
export const promptOverwriteEnvVariable = async (key: string): Promise<void> => {
  const { confirmMessage, noticeMessage, warningMessage } = generateUnsetMessage(key)
  log(warningMessage)
  log()
  log(noticeMessage)
  await confirmPrompt(confirmMessage)
}
