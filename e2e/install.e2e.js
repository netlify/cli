const { mkdir } = require('fs').promises
const { existsSync } = require('fs')
const { platform } = require('os')
const { join, resolve } = require('path')
const process = require('process')

const test = require('ava')
const execa = require('execa')

const { version } = require('../package.json')

const { packageManagerConfig, packageManagerExists } = require('./utils')

/**
 * Prepares the workspace for the test suite to run
 * @param {string} folderName
 */
const prepare = async (folderName) => {
  const folder = join(process.env.E2E_TEST_WORKSPACE, folderName)
  await mkdir(folder, { recursive: true })
  return folder
}

Object.entries(packageManagerConfig).forEach(([packageManager, { install: installCmd, lockFile }]) => {
  /** @type {import('ava').TestInterface} */
  const testSuite = packageManagerExists(packageManager) ? test : test.skip

  testSuite(`${packageManager} → should install the cli and run the help command`, async (t) => {
    const cwd = await prepare(`${packageManager}-try-install`)
    await execa(...installCmd, { stdio: process.env.DEBUG ? 'inherit' : 'ignore', cwd })

    t.is(existsSync(join(cwd, lockFile)), true, `Generated lock file ${lockFile} does not exists in ${cwd}`)

    const binary = resolve(join(cwd, `./node_modules/.bin/netlify${platform() === 'win32' ? '.cmd' : ''}`))
    const { stdout } = await execa(binary, ['help'], { cwd })

    t.is(stdout.trim().startsWith('VERSION'), true, `Help command does not start with 'VERSION':\n\n${stdout}`)
    t.is(
      stdout.includes(`netlify-cli/${version}`),
      true,
      `Help command does not include 'netlify-cli/${version}':\n\n${stdout}`,
    )
    t.is(
      stdout.includes(`$ netlify [COMMAND]`),
      true,
      `Help command does not include '$ netlify [COMMAND]':\n\n${stdout}`,
    )
  })
})
