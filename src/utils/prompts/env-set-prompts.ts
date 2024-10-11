import { chalk, log } from '../command-helpers.js'

import { confirmPrompt } from './confirm-prompt.js'

// const generateMessage = ({ context, scope }: ContextScope, variableName: string): void => {
//   log()
//   log(`${chalk.redBright('Warning')}: The environment variable ${variableName} already exists!`)

//   if (!context && !scope) {
//     log(`${chalk.redBright('Warning')}: No context or scope defined - this will apply to ALL contexts and ALL scopes`)
//   } else if (!context) {
//     log(`${chalk.redBright('Warning')}: No context defined - this will apply to ALL contexts`)
//   } else if (!scope) {
//     log(`${chalk.redBright('Warning')}: No scope defined - this will apply to ALL scopes`)
//   }

//   log()
//   log(`• New Context: ${context || 'ALL'}`)
//   log(`• New Scope: ${scope || 'ALL'}`)
//   log()
//   log(`${chalk.yellowBright('Notice')}: To skip this prompt, pass a -f or --force flag`)
//   log()
// }

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
