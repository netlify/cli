import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

export const promptBlobSetOverwrite = async (key: string, storeName: string): Promise<void> => {
  const warningMessage = destructiveCommandMessages.blobSet.generateWarning(key, storeName)

  log()
  log(warningMessage)
  log()
  log(destructiveCommandMessages.overwriteNotice)
  await confirmPrompt(destructiveCommandMessages.blobSet.overwriteConfirmation)
}
