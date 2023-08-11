#!/usr/bin/env node
import { argv } from 'process'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../src/commands/index.mjs'
import { error } from '../src/utils/command-helpers.mjs'
import getPackageJson from '../src/utils/get-package-json.mjs'

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
  await program.parseAsync(argv)
  program.onEnd()
} catch (error_) {
  program.onEnd(error_)
}
