#!/usr/bin/env node
/* eslint-disable eslint-comments/disable-enable-pair, promise/prefer-await-to-callbacks */
const { join } = require('path')
const process = require('process')

const execa = require('execa')

const { setup } = require('./setup')

/** The main test runner function */
const main = async () => {
  const { cleanup, registry, workspace } = await setup()

  let statusCode = 0

  try {
    const { exitCode } = await execa('ava', ['**/*.e2e.js', '--config', join(process.cwd(), 'e2e.config.cjs')], {
      stdio: 'inherit',
      env: {
        E2E_TEST_WORKSPACE: workspace,
        E2E_TEST_REGISTRY: registry,
      },
    })

    statusCode = exitCode
  } catch (_error) {
    await cleanup()
    console.error(_error instanceof Error ? _error.message : _error)
  }

  await cleanup()
  process.exit(statusCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
