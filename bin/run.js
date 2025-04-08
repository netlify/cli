#!/usr/bin/env node
import * as module from 'module'
import { tmpdir } from 'os'
import * as path from 'path'
import { argv } from 'process'

import { isCI } from 'ci-info'
import updateNotifier from 'update-notifier'

import getPackageJson from '../dist/utils/get-cli-package-json.js'

// 12 hours
const UPDATE_CHECK_INTERVAL = 432e5

/* eslint-disable n/no-unsupported-features/node-builtins */
const maybeEnableCompileCache = () => {
  // The Netlify CLI is often used in CI workflows. In this context, we wouldn't want the overhead of the first run
  // because we almost certainly would not get any benefits on "subsequent runs". Even if the user has configured
  // caching of the CLI itself, there's no chance they've configured the V8 compile cache directory to be cached.
  if (isCI) return false

  // This was added in node 22.8.0, but we currently support >=18.14.0. As the CLI is generally run hundreds of times,
  // it is worth a small overhead on the very first run post-install to shave tens to hundreds of milliseconds on every
  // subsequent run.
  // @see https://nodejs.org/api/module.html#moduleenablecompilecachecachedir
  if ('enableCompileCache' in module && typeof module.enableCompileCache === 'function') {
    // By design, this cannot throw.
    // @see https://nodejs.org/api/module.html#moduleenablecompilecachecachedir
    module.enableCompileCache()
    // This has no impact on this process. It enables the compile cache for spawned subprocesses.
    process.env.NODE_COMPILE_CACHE ??= path.join(tmpdir(), 'node-compile-cache')
    return true
  }
  return false
}
/* eslint-enable n/no-unsupported-features/node-builtins */

const main = async () => {
  // Must come first, including before any imports
  const didEnableCompileCache = maybeEnableCompileCache()

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

  const program = createMainCommand(didEnableCompileCache)

  try {
    await runProgram(program, argv)

    program.onEnd()
  } catch (error) {
    program.onEnd(error)
  }
}

await main()
