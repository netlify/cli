#!/usr/bin/env node
import { argv } from 'process'

import updateNotifier from 'update-notifier'

import { runProgram } from '../dist/utils/run-program.js'
import { error } from '../dist/utils/command-helpers.js'
import getPackageJson from '../dist/utils/get-package-json.js'
import { createMainCommand } from '../dist/commands/main.js'

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
  await runProgram(program, argv)

  program.onEnd()
} catch (error_) {
  program.onEnd(error_)
}
