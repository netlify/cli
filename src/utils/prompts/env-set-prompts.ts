import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

const generateSetMessage = (variableName: string): void => {
  log()
  log(`${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(variableName)} already exists!`)
  log()
  log(
    `${chalk.yellowBright(
      'Notice',
    )}: To overwrite the existing variable without confirmation, pass the -f or --force flag.`,
  )
}

export const envSetPrompts = async (key: string): Promise<void> => {
  generateSetMessage(key)
  await confirmPrompt('The environment variable already exists. Do you want to overwrite it?')
}
