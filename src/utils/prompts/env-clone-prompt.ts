import { log } from '../command-helpers.js'
import { EnvVar } from '../types.js'

import { confirmPrompt } from './confirm-prompt.js'
import { destructiveCommandMessages } from './prompt-messages.js'

export const generateEnvVarsList = (envVarsToDelete: EnvVar[]) => envVarsToDelete.map((envVar) => envVar.key)

/**
 * Prompts the user to confirm overwriting environment variables on a site.
 *
 * @param {string} siteId - The ID of the site.
 * @param {EnvVar[]} existingEnvVars - The environment variables that already exist on the site.
 * @returns {Promise<void>} A promise that resolves when the user has confirmed the overwriting of the variables.
 */
export async function promptEnvCloneOverwrite(siteId: string, existingEnvVars: EnvVar[]): Promise<void> {
  const { generateWarning } = destructiveCommandMessages.envClone

  const existingEnvVarKeys = generateEnvVarsList(existingEnvVars)
  const warningMessage = generateWarning(siteId)

  log()
  log(warningMessage)
  log()
  log(destructiveCommandMessages.envClone.noticeEnvVars)
  log()
  existingEnvVarKeys.forEach((envVar) => {
    log(envVar)
  })
  log()
  log(destructiveCommandMessages.overwriteNotice)

  await confirmPrompt(destructiveCommandMessages.envClone.overwriteConfirmation)
}
