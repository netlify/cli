import { log, exit } from '../command-helpers.js'

import { promptConfirm } from './index.js'

export const confirmPrompt = async (message: string): Promise<void> => {
  const confirm = await promptConfirm({ message, initialValue: false })
  log()
  if (!confirm) {
    exit()
  }
}
