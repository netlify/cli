import { existsSync, readFileSync } from 'fs'
import { mkdir } from 'fs/promises'
import { platform } from 'os'
import { join, resolve } from 'path'
import { env } from 'process'
import { fileURLToPath } from 'url'

import { execa } from 'execa'
import { expect, test } from 'vitest'

import { packageManagerConfig, packageManagerExists } from './utils.js'

const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'))

/**
 * Prepares the workspace for the test suite to run
 * @param {string} folderName
 */
const prepare = async (folderName) => {
  const folder = join(env.E2E_TEST_WORKSPACE, folderName)
  await mkdir(folder, { recursive: true })
  return folder
}

Object.entries(packageManagerConfig).forEach(([packageManager, { install: installCmd, lockFile }]) => {
  test.runIf(packageManagerExists(packageManager))(
    `${packageManager} → should install the cli and run the help command`,
    async () => {
      const cwd = await prepare(`${packageManager}-try-install`)
      await execa(...installCmd, { stdio: env.DEBUG ? 'inherit' : 'ignore', cwd })

      expect(existsSync(join(cwd, lockFile)), `Generated lock file ${lockFile} does not exists in ${cwd}`).toBe(true)

      const binary = resolve(join(cwd, `./node_modules/.bin/netlify${platform() === 'win32' ? '.cmd' : ''}`))
      const { stdout } = await execa(binary, ['help'], { cwd })

      expect(stdout.trim(), `Help command does not start with 'VERSION':\n\n${stdout}`).toMatch(/^VERSION/)
      expect(stdout, `Help command does not include 'netlify-cli/${version}':\n\n${stdout}`).toContain(
        `netlify-cli/${version}`,
      )
      expect(stdout, `Help command does not include '$ netlify [COMMAND]':\n\n${stdout}`).toMatch('$ netlify [COMMAND]')
    },
  )
})
