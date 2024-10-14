import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

const generateBlobWarningMessage = (key: string, storeName: string): void => {
  log()
  log(`${chalk.redBright('Warning')}: The following blob key already exists in store ${chalk.cyan(storeName)}:`)
  log()
  log(`${chalk.bold(key)}`)
  log()
  log(`This operation will ${chalk.redBright('overwrite')} the existing value.`)
  log(`${chalk.yellowBright('Notice')}: To overwrite without this warning, you can use the --force flag.`)
  log()
}

export const blobSetPrompts = async (key: string, storeName: string): Promise<void> => {
  generateBlobWarningMessage(key, storeName)
  await confirmPrompt('Do you want to proceed with overwriting this blob key existing value?')
}
