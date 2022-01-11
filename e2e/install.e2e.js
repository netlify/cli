const { mkdir } = require('fs').promises
const { existsSync } = require('fs')
const { platform } = require('os')
const { join, resolve } = require('path')
const process = require('process')

const test = require('ava')
const execa = require('execa')

const { version } = require('../package.json')

const { packageManagerConfig, packageManagerExists } = require('./utils')

const [packageManager] = process.argv.slice(2)
const testSuite = packageManagerExists(packageManager) ? test : test.skip

/**
 * Prepares the workspace for the test suite to run
 * @param {string} folderName
 */
const prepare = async (folderName) => {
  const folder = join(process.env.E2E_TEST_WORKSPACE, folderName)
  await mkdir(folder, { recursive: true })
  process.chdir(folder)
}

testSuite(`${packageManager} → should install the cli and run the help command`, async (t) => {
  await prepare(`${packageManager}-try-install`)
  const { install: installCmd, lockFile } = packageManagerConfig[packageManager]
  console.log(`$ ${installCmd[0]} ${installCmd[1].join(' ')}`)
  await execa(...installCmd, { stdio: 'inherit' })

  t.is(existsSync(lockFile), true)

  const binary = resolve(`./node_modules/.bin/netlify${platform() === 'win32' ? '.cmd' : ''}`)

  console.log(`$ ${binary} help`)
  const { stdout } = await execa(binary, ['help'])

  t.is(stdout.trim().startsWith('VERSION'), true)
  t.is(stdout.includes(`netlify-cli/${version}`), true)
  t.is(stdout.includes(`$ netlify [COMMAND]`), true)
})
