import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

/**
 * Prompts the user to confirm overwriting an existing environment variable.
 *
 * @param {string} existingKey - The key of the existing environment variable.
 * @returns {Promise<void>} A promise that resolves when the user confirms overwriting the variable.
 */
export const promptOverwriteEnvVariable = async (existingKey: string): Promise<void> => {
  const { overwriteNoticeMessage } = destructiveCommandMessages
  const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.envSet

  const warningMessage = generateWarningMessage(existingKey)

  log()
  log(warningMessage)
  log()
  log(overwriteNoticeMessage)
  await confirmPrompt(overwriteConfirmationMessage)
}
