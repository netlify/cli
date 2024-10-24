import { log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

export const promptOverwriteEnvVariable = async (key: string): Promise<void> => {
  const warningMessage = destructiveCommandMessages.envSet.generateWarning(key)

  log()
  log(warningMessage)
  log()
  log(destructiveCommandMessages.overwriteNotice)
  await confirmPrompt(destructiveCommandMessages.envSet.overwriteConfirmation)
}
