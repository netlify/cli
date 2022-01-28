#!/usr/bin/env node
import { readFileSync } from 'fs'
import { argv } from 'process'
import { fileURLToPath } from 'url'

import updateNotifier from 'update-notifier'

import { createMainCommand } from '../src/commands/index.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url))), 'utf-8')

try {
  updateNotifier({
    pkg,
    updateCheckInterval: UPDATE_CHECK_INTERVAL,
  }).notify()
} catch (error_) {
  console.log('Error checking for updates:')
  console.log(error_)
}

const program = createMainCommand()

program.parseAsync(argv).catch((error_) => {
  program.onEnd(error_)
})
