import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

const generateBlobWarningMessage = (key: string, storeName: string): void => {
  log()
  log(
    `${chalk.redBright('Warning')}: The following blob key ${chalk.cyan(key)} will be deleted from store ${chalk.cyan(
      storeName,
    )}:`,
  )
  log()
  log(`${chalk.yellowBright('Notice')}: To overwrite without this warning, you can use the --force flag.`)
  log()
}

export const blobDeletePrompts = async (key: string, storeName: string): Promise<void> => {
  generateBlobWarningMessage(key, storeName)
  await confirmPrompt('Do you want to proceed with deleting the value at this key?')
}
