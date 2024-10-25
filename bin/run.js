#!/usr/bin/env node
import { argv } from 'process'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../dist/commands/index.js'
import { error } from '../dist/utils/command-helpers.js'
import getPackageJson from '../dist/utils/get-package-json.js'

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

  // Is the command run in a non-interactive shell or CI/CD environment?
  const scriptedCommand = program.scriptedCommand

  // Is not the base `netlify command w/o any flags
  const notNetlifyCommand = argv.length > 2

  // Is not the base `netlify` command w/ flags
  const notNetlifyCommandWithFlags = argv[2] && !(argv[2].startsWith('-'))

  // is not the `netlify help` command
  const notNetlifyHelpCommand = argv[2] && !(argv[2] === 'help')

  // Is the `--force` flag not already present?
  const noForceFlag = !argv.includes('--force')

  // Prevents prompts from blocking scripted commands
  if (
    scriptedCommand &&
    notNetlifyCommand &&
    notNetlifyCommandWithFlags &&
    notNetlifyHelpCommand &&
    noForceFlag
  ) {
    argv.push("--force")
  }

  await program.parseAsync(argv)

  program.onEnd()
} catch (error_) {
  program.onEnd(error_)
}
