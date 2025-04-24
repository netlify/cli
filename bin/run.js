#!/usr/bin/env node
import { argv } from 'process'

import { maybeEnableCompileCache } from '../dist/utils/nodejs-compile-cache.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

const NETLIFY_CYAN_HEX = '#28b5ac'
const UPDATE_BOXEN_OPTIONS = {
  padding: 1,
  margin: 1,
  textAlignment: 'center',
  borderStyle: 'round', 
  borderColor: NETLIFY_CYAN_HEX,
  float: 'center',
  title: '⬥ ',
  titleAlignment: 'center',
}

const main = async () => {
  const { default: chalk } = await import('chalk')
  const { default: updateNotifier } = await import('update-notifier')
  const { default: terminalLink } = await import('terminal-link')
  const { createMainCommand } = await import('../dist/commands/main.js')
  const { logError } = await import('../dist/utils/command-helpers.js')
  const { default: getPackageJson } = await import('../dist/utils/get-cli-package-json.js')
  const { runProgram } = await import('../dist/utils/run-program.js')

  try {
    const pkg = await getPackageJson()
    const message = `Update available ${chalk.dim('{currentVersion}')} → ${chalk.green('{latestVersion}')}
See what's new in the ${terminalLink('release notes', 'https://ntl.fyi/cli-versions')}

Run ${chalk.inverse.hex(NETLIFY_CYAN_HEX)('{updateCommand}')} to update`
    updateNotifier({
      pkg,
      updateCheckInterval: UPDATE_CHECK_INTERVAL,
    }).notify({ message, boxenOptions: UPDATE_BOXEN_OPTIONS })
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
