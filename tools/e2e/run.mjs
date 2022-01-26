#!/usr/bin/env node
import { join } from 'path'
import { cwd, exit } from 'process'

import { execa } from 'execa'

import { setup } from './setup.js'

const main = async () => {
  const { cleanup, registry, workspace } = await setup()

  // By default assume it is failing, so we don't have to set it when something goes wrong
  // if it is going successful it will be set
  let statusCode = 1

  try {
    console.log('Start running ava tests for **/*.e2e.js')
    const { exitCode } = await execa('ava', ['**/*.e2e.js', '--config', join(cwd(), 'e2e.config.cjs')], {
      stdio: 'inherit',
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
