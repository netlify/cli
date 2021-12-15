#!/usr/bin/env node
import { readFileSync } from 'fs'
import process from 'process'
import { fileURLToPath } from 'url'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../src/commands/index.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url).pathname), 'utf-8')

  try {
    updateNotifier({
      pkg,
      updateCheckInterval: UPDATE_CHECK_INTERVAL,
    }).notify()
  } catch (error) {
    console.log('Error checking for updates:')
    console.log(error)
  }

  /** @type {Error} */
  let caughtError

  const program = createMainCommand()

  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    caughtError = error
  }

  // long running commands like dev server cannot be caught by a post action hook
  // they are running on the main command
  process.on('exit', () => {
    program.onEnd(caughtError)
  })
}
