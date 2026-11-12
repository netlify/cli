import { confirm } from '@inquirer/prompts'

import { log, exit } from '../command-helpers.js'

export const confirmPrompt = async (message: string): Promise<void> => {
  const confirmed = await confirm({ message, default: false })
  log()
  if (!confirmed) {
    exit()
  }
}
