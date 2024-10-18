import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

const generateUnsetMessage = (variableName: string): void => {
  log()
  log(
    `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(
      variableName,
    )} will be unset (deleted)!`,
  )
  log()
  log(`${chalk.yellowBright('Notice')}: To unset the variable without confirmation, pass the -f or --force flag.`)
}

export const envUnsetPrompts = async (key: string): Promise<void> => {
  generateUnsetMessage(key)
  await confirmPrompt('Are you sure you want to unset (delete) the environment variable?')
}
