#!/usr/bin/env node
import { readFileSync } from 'fs'
import process from 'process'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../src/commands/index.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

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

const program = createMainCommand()

try {
  await program.parseAsync(process.argv)
} catch (error_) {
  program.onEnd(error_)
}
