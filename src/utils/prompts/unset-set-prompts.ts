import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

/**
 * Logs a warning and prompts user to confirm overwriting an existing environment variable
 *
 * @param {string} key - The key of the environment variable that already exists
 * @returns {Promise<void>} A promise that resolves when the user has confirmed overwriting the variable
 */
export const promptOverwriteEnvVariable = async (existingKey: string): Promise<void> => {
  const { overwriteNoticeMessage } = destructiveCommandMessages
  const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.envUnset

  const warningMessage = generateWarningMessage(existingKey)

  log(warningMessage)
  log()
  log(overwriteNoticeMessage)
  await confirmPrompt(overwriteConfirmationMessage)
}
