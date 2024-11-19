import inquirer from 'inquirer'

import { log, exit } from '../command-helpers.js'

export const confirmPrompt = async (message: string): Promise<void> => {
  try {
    const { confirm } = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      message,
      default: false,
    })
    log()
    if (!confirm) {
      exit()
    }
  } catch (error) {
    console.error(error)
    exit()
  }
}
