#!/usr/bin/env node
/* eslint-disable eslint-comments/disable-enable-pair, promise/prefer-await-to-callbacks */
require('ava/lib/chalk').set()
const process = require('process')

const Api = require('ava/lib/api')
const DefaultReporter = require('ava/lib/reporters/default')
const glob = require('fast-glob')

const { setup } = require('./setup')

/**
 * Runs the e2e tests and returns the exit code
 * @param {object} config
 * @param {string} config.glob
 * @param {string} config.workspace
 * @param {string} config.registry
 * @param {string} config.packageManager
 * @returns {Promise<number>}
 * @returns
 */
const runTests = async ({ packageManager, registry, testGlob, workspace }) => {
  const tests = await glob(testGlob)
  const projectDir = process.cwd()

  const reporter = new DefaultReporter({
    projectDir,
    reportStream: process.stdout,
    stdStream: process.stderr,
    verbose: process.env.CI || !process.stdout.isTTY,
  })

  const api = new Api({
    cacheEnabled: true,
    chalkOptions: { level: 3 },
    // eslint-disable-next-line no-magic-numbers
    concurrency: 5,
    debug: null,
    environmentVariables: {
      E2E_TEST_WORKSPACE: workspace,
      E2E_TEST_REGISTRY: registry,
    },
    experiments: {},
    extensions: ['cjs', 'mjs', 'js'],
    failFast: false,
    failWithoutAssertions: false,
    globs: {
      extensions: ['cjs', 'mjs', 'js'],
      filePatterns: [testGlob],
      ignoredByWatcherPatterns: ['**/*.snap.md', 'ava.config.js', 'ava.config.cjs'],
    },
    match: [],
    moduleTypes: { cjs: 'commonjs', mjs: 'module', js: 'commonjs' },
    nodeArguments: [],
    parallelRuns: null,
    projectDir,
    providers: [],
    ranFromCli: true,
    require: [],
    serial: undefined,
    snapshotDir: null,
    timeout: '5m',
    updateSnapshots: undefined,
    workerArgv: [packageManager],
  })

  api.on('run', (plan) => {
    reporter.startRun(plan)
  })

  const runStatus = await api.run({ filter: tests.map((test) => ({ pattern: test })) })
  reporter.endRun()

  return runStatus.suggestExitCode({ matching: false })
}

/** The main test runner function */
const main = async () => {
  const [packageManager] = process.argv.slice(2)

  if (!packageManager || packageManager.length === 0) {
    throw new Error(
      `Please provide a package manager by running 'npm run e2e -- npm'. It can be 'npm', 'yarn' or 'pnpm'.`,
    )
  }

  const { cleanup, registry, workspace } = await setup()

  let statusCode = 0

  try {
    statusCode = await runTests({ testGlob: '**/*.e2e.js', workspace, registry, packageManager })
  } catch (_error) {
    await cleanup()
    throw _error
  }

  await cleanup()
  process.exit(statusCode)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
