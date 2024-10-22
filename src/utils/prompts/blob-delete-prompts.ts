import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

export const promptBlobDelete = async (key: string, storeName: string): Promise<void> => {
  const { overwriteNoticeMessage } = destructiveCommandMessages
  const { generateWarningMessage, overwriteConfirmationMessage } = destructiveCommandMessages.blobDelete

  const warningMessage = generateWarningMessage(key, storeName)

  log()
  log(warningMessage)
  log()
  log(overwriteNoticeMessage)
  await confirmPrompt(overwriteConfirmationMessage)
}
