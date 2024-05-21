#!/usr/bin/env node
import { dirname, join } from 'path'
import { exit } from 'process'
import { fileURLToPath } from 'url'

import { execa } from 'execa'

import { setup } from './setup.js'

/** The main test runner function */
const main = async () => {
  const { cleanup, registry, workspace } = await setup()

  // By default assume it is failing, so we don't have to set it when something goes wrong
  // if it is going successful it will be set
  let statusCode = 1

  try {
    console.log('Start running tests for ./e2e/**/*.e2e.js')
    const { exitCode } = await execa('vitest', ['run', '--config=vitest.e2e.config.ts', '--reporter=basic'], {
      stdio: 'inherit',
      cwd: join(dirname(fileURLToPath(import.meta.url)), '../..'),
      env: {
        E2E_TEST_WORKSPACE: workspace,
        E2E_TEST_REGISTRY: registry,
      },
    })
    statusCode = exitCode
  } catch (error_) {
    await cleanup()
    console.error(error_ instanceof Error ? error_.message : error_)
  }

  await cleanup()
  exit(statusCode)
}

main().catch((error_) => {
  console.error(error_ instanceof Error ? error_.message : error_)
  exit(1)
})
