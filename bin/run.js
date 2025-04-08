#!/usr/bin/env node
import { argv } from 'process'

import updateNotifier from 'update-notifier'

import getPackageJson from '../dist/utils/get-cli-package-json.js'
import { maybeEnableCompileCache } from '../dist/utils/nodejs-compile-cache.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

const main = async () => {
  const { createMainCommand } = await import('../dist/commands/main.js')
  const { logError } = await import('../dist/utils/command-helpers.js')
  const { runProgram } = await import('../dist/utils/run-program.js')

  const pkg = await getPackageJson()

  try {
    updateNotifier({
      pkg,
      updateCheckInterval: UPDATE_CHECK_INTERVAL,
    }).notify()
  } catch (error) {
    logError(`Error checking for updates: ${error?.toString()}`)
  }

  const program = createMainCommand()

  try {
    await runProgram(program, argv)

    program.onEnd()
  } catch (error) {
    program.onEnd(error)
  }
}

// Must come first, including before any imports
maybeEnableCompileCache()

await main()
