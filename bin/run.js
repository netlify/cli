#!/usr/bin/env node
import { argv } from 'process'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../dist/commands/index.js'
import { error } from '../dist/utils/command-helpers.js'
import getPackageJson from '../dist/utils/get-package-json.js'
import { injectForceFlagIfScripted } from '../dist/utils/scripted-commands.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5
const pkg = await getPackageJson()

try {
  updateNotifier({
    pkg,
    updateCheckInterval: UPDATE_CHECK_INTERVAL,
  }).notify()
} catch (error_) {
  error('Error checking for updates:')
  error(error_)
}

const program = createMainCommand()

try {
  const isValidCommand = program.commands.some((cmd) => cmd.name() === argv[2])

  if (isValidCommand) {
    injectForceFlagIfScripted(argv)
  }
  // inject the force flag if the command is a non-interactive shell or Ci enviroment

  await program.parseAsync(argv)

  program.onEnd()
} catch (error_) {
  program.onEnd(error_)
}
