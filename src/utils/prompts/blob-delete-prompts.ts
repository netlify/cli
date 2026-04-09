import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

export const promptBlobDelete = async (key: string, storeName: string): Promise<void> => {
  const warningMessage = destructiveCommandMessages.blobDelete.generateWarning(key, storeName)

  log()
  log(warningMessage)
  log()
  log(destructiveCommandMessages.overwriteNotice)
  await confirmPrompt(destructiveCommandMessages.blobDelete.overwriteConfirmation)
}
