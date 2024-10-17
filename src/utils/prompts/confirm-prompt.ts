import inquirer from 'inquirer'

import { log, exit } from '../command-helpers.js'

export const confirmPrompt = async (message: string): Promise<void> => {
  try {
    const { wantsToSet } = await inquirer.prompt({
      type: 'confirm',
      name: 'wantsToSet',
      message,
      default: false,
    })
    log()
    if (!wantsToSet) {
      exit()
    }
  } catch (error) {
    console.error(error)
    exit()
  }
}
