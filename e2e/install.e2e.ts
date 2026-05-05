import http from 'node:http'
import os from 'node:os'
import events from 'node:events'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { platform } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import process from 'node:process'

import execa from 'execa'
import { runServer } from 'verdaccio'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import createDebug from 'debug'
import picomatch from 'picomatch'

import pkg from '../package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')
const tempdirPrefix = 'netlify-cli-e2e-test--'

const debug = createDebug('netlify-cli:e2e')
const isNodeModules = picomatch('**/node_modules/**', { dot: true })
const shouldCopyCLIFile = async (src: string) => {
  if (isNodeModules(src)) return false

  try {
    const st = await fs.lstat(src) // DO NOT follow symlinks
    if (st.isSocket() || st.isFIFO() || st.isCharacterDevice() || st.isBlockDevice()) {
      return false
    }
  } catch {
    // If we can't lstat it, skip it
    return false
  }

  return true
}

// Shared registry state: one verdaccio server + one publish for all tests.
const shared: {
  registryURL: string
  server: http.Server | null
  verdaccioStorageDir: string
} = {
  registryURL: '',
  server: null,
  verdaccioStorageDir: '',
}

beforeAll(async () => {
  try {
    if (!(await fs.stat(distDir)).isDirectory()) {
      throw new Error(`found unexpected non-directory at "${distDir}"`)
    }
  } catch (err) {
    throw new Error(
      '"dist" directory does not exist or is not a directory. The project must be built before running E2E tests.',
      { cause: err },
    )
  }

  shared.verdaccioStorageDir = await fs.mkdtemp(path.join(os.tmpdir(), `${tempdirPrefix}verdaccio-storage`))
  const server: http.Server = (await runServer({
    self_path: __dirname,
    storage: shared.verdaccioStorageDir,
    web: { title: 'Test Registry' },
    max_body_size: '128mb',
    max_users: -1,
    log: { level: 'fatal' },
    uplinks: {
      npmjs: {
        url: 'https://registry.npmjs.org/',
        maxage: '1d',
        timeout: '60s',
        max_fails: 5,
        fail_timeout: '5m',
        cache: true,
      },
    },
    packages: {
      '@*/*': {
        access: '$all',
        publish: 'noone',
        proxy: 'npmjs',
      },
      'netlify-cli': {
        access: '$all',
        publish: '$all',
      },
      netlify: {
        access: '$all',
        publish: '$all',
      },
      '**': {
        access: '$all',
        publish: 'noone',
        proxy: 'npmjs',
      },
    },
  })) as http.Server

  shared.server = server

  await Promise.all([
    Promise.race([
      events.once(server, 'listening'),
      events.once(server, 'error').then(() => {
        throw new Error('Verdaccio server failed to start')
      }),
    ]),
    server.listen(),
  ])
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to open Verdaccio server')
  }
  const registryURL = new URL(
    `http://${
      address.family === 'IPv6' && address.address === '::' ? 'localhost' : address.address
    }:${address.port.toString()}`,
  )
  shared.registryURL = registryURL.toString()

  // The CLI publishing process modifies the workspace, so copy it to a temporary directory. This
  // lets us avoid contaminating the user's workspace when running these tests locally.
  const publishWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), `${tempdirPrefix}publish-workspace`))
  // At this point, the project is built. As long as we limit the prepublish script to built-
  // ins, node_modules are not necessary to publish the package.
  await fs.cp(projectRoot, publishWorkspace, {
    recursive: true,
    verbatimSymlinks: true,
    filter: shouldCopyCLIFile,
  })
  await fs.writeFile(
    path.join(publishWorkspace, '.npmrc'),
    `//${registryURL.hostname}:${registryURL.port}/:_authToken=dummy`,
  )
  await execa('npm', ['publish', `--registry=${registryURL.toString()}`, '--tag=testing'], {
    cwd: publishWorkspace,
    stdio: debug.enabled ? 'inherit' : 'ignore',
  })

  // TODO: Figure out why calling this script is failing on Windows.
  if (platform() !== 'win32') {
    await execa.node(path.resolve(projectRoot, 'scripts/netlifyPackage.js'), {
      cwd: publishWorkspace,
      stdio: debug.enabled ? 'inherit' : 'ignore',
    })
    await execa('npm', ['publish', `--registry=${registryURL.toString()}`, '--tag=testing'], {
      cwd: publishWorkspace,
      stdio: debug.enabled ? 'inherit' : 'ignore',
    })
  }

  await fs.rm(publishWorkspace, { force: true, recursive: true, maxRetries: 3, retryDelay: 1000 })
}, 120_000)

// In CI the process exits after tests, so skip cleanup to save time.
if (!process.env.CI) {
  afterAll(async () => {
    if (shared.server) {
      await Promise.all([
        events.once(shared.server, 'close'),
        shared.server.close(),
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        shared.server.closeAllConnections(),
      ])
    }
    if (shared.verdaccioStorageDir) {
      await fs.rm(shared.verdaccioStorageDir, { force: true, recursive: true, maxRetries: 3, retryDelay: 1000 })
    }
  })
}

type Test = { packageName: string }
type InstallTest = Test & {
  install: [cmd: string, args: string[]]
  lockfile: string
  cleanInstall: [cmd: string, args: string[]]
}
type RunTest = Test & { run: [cmd: string, args: string[]] }

const installTests: [packageManager: string, config: InstallTest][] = [
  [
    'npm',
    {
      packageName: 'netlify-cli',
      install: ['npm', ['install', 'netlify-cli@testing']],
      cleanInstall: ['npm', ['ci']],
      lockfile: 'package-lock.json',
    },
  ],
  [
    'pnpm',
    {
      packageName: 'netlify-cli',
      install: ['pnpm', ['add', 'netlify-cli@testing']],
      cleanInstall: ['pnpm', ['install', '--frozen-lockfile']],
      lockfile: 'pnpm-lock.yaml',
    },
  ],
  [
    'yarn',
    {
      packageName: 'netlify-cli',
      install: ['yarn', ['add', 'netlify-cli@testing']],
      cleanInstall: ['yarn', ['install', '--frozen-lockfile']],
      lockfile: 'yarn.lock',
    },
  ],
]

describe.each(installTests)('%s → installs the cli and runs commands without errors', (packageManager, config) => {
  // Yarn v1 enforces engine constraints strictly. A transitive dep (chokidar@5) requires node >=20.19.0,
  // breaking yarn installs on older Node 20.x. Node 20 EOL is April 2026, so we skip rather than override.
  const yarnOnOldNode20 = packageManager === 'yarn' && process.versions.node === '20.12.2'

  it.skipIf(yarnOnOldNode20)('runs the commands without errors', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), tempdirPrefix))

    try {
      const installResult = await execa(...config.install, {
        cwd,
        env: { npm_config_registry: shared.registryURL },
        all: true,
        reject: false,
      })
      if (installResult.exitCode !== 0) {
        throw new Error(
          `Install failed for ${packageManager}\nExit code: ${installResult.exitCode.toString()}\n\n${
            installResult.all || ''
          }`,
        )
      }

      expect(
        existsSync(path.join(cwd, config.lockfile)),
        `Generated lock file ${config.lockfile} does not exist in ${cwd}`,
      ).toBe(true)

      // Regression test: ensure we don't trigger known `npm ci` bugs: https://github.com/npm/cli/issues/7622.
      const cleanInstallResult = await execa(...config.cleanInstall, {
        cwd,
        env: { npm_config_registry: shared.registryURL },
        all: true,
        reject: false,
      })
      if (cleanInstallResult.exitCode !== 0) {
        throw new Error(
          `Clean install failed for ${packageManager}\nExit code: ${cleanInstallResult.exitCode.toString()}\n\n${
            cleanInstallResult.all || ''
          }`,
        )
      }

      const binary = path.resolve(path.join(cwd, `./node_modules/.bin/netlify${platform() === 'win32' ? '.cmd' : ''}`))

      // Help

      const helpResult = await execa(binary, ['help'], { cwd, all: true, reject: false })
      if (helpResult.exitCode !== 0) {
        throw new Error(
          `Help command failed: ${binary} help\nExit code: ${helpResult.exitCode.toString()}\n\n${
            helpResult.all || ''
          }`,
        )
      }
      const helpOutput = helpResult.stdout

      expect(helpOutput.trim(), `Help command does not start with '⬥ Netlify CLI'\\n\\nVERSION: ${helpOutput}`).toMatch(
        /^⬥ Netlify CLI\n\nVERSION/,
      )
      expect(
        helpOutput,
        `Help command does not include '${config.packageName}/${pkg.version}':\n\n${helpOutput}`,
      ).toContain(`${config.packageName}/${pkg.version}`)
      expect(helpOutput, `Help command does not include '$ netlify [COMMAND]':\n\n${helpOutput}`).toMatch(
        '$ netlify [COMMAND]',
      )

      // Unlink

      const unlinkResult = await execa(binary, ['unlink'], { cwd, all: true, reject: false })
      if (unlinkResult.exitCode !== 0) {
        throw new Error(
          `Unlink command failed: ${binary} unlink\nExit code: ${unlinkResult.exitCode.toString()}\n\n${
            unlinkResult.all || ''
          }`,
        )
      }
      const unlinkOutput = unlinkResult.stdout
      expect(unlinkOutput, `Unlink command includes command context':\n\n${unlinkOutput}`).toContain(
        `Run netlify link to link it`,
      )
    } finally {
      if (!process.env.CI) {
        await fs.rm(cwd, { force: true, recursive: true, maxRetries: 3, retryDelay: 1000 })
      }
    }
  })
})

const runTests: [packageManager: string, config: RunTest][] = [
  [
    'npx',
    {
      packageName: 'netlify',
      run: ['npx', ['-y', 'netlify@testing']],
    },
  ],
  [
    'pnpx',
    {
      packageName: 'netlify',
      run: ['pnpx', ['netlify@testing']],
    },
  ],
]

describe.each(runTests)('%s → runs cli commands without errors', (packageManager, config) => {
  // TODO: Figure out why this flow is failing on Windows.
  const skipOnWindows = platform() === 'win32'

  it.skipIf(skipOnWindows)('runs commands without errors', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), tempdirPrefix))
    const [cmd, args] = config.run
    const env = {
      npm_config_registry: shared.registryURL,
    }

    try {
      const installResult = await execa(cmd, [...args], { env, all: true, reject: false })
      if (installResult.exitCode !== 0) {
        throw new Error(
          `Install failed for ${packageManager}\nExit code: ${installResult.exitCode.toString()}\n\n${
            installResult.all || ''
          }`,
        )
      }

      // Help

      const helpResult = await execa(cmd, [...args, 'help'], { env, all: true, reject: false })
      if (helpResult.exitCode !== 0) {
        throw new Error(
          `Help command failed: ${cmd} ${args.join(' ')} help\nExit code: ${helpResult.exitCode.toString()}\n\n${
            helpResult.all || ''
          }`,
        )
      }
      const helpOutput = helpResult.stdout

      expect(helpOutput.trim(), `Help command does not start with '⬥ Netlify CLI'\\n\\nVERSION: ${helpOutput}`).toMatch(
        /^⬥ Netlify CLI\n\nVERSION/,
      )
      expect(
        helpOutput,
        `Help command does not include '${config.packageName}/${pkg.version}':\n\n${helpOutput}`,
      ).toContain(`${config.packageName}/${pkg.version}`)
      expect(helpOutput, `Help command does not include '$ netlify [COMMAND]':\n\n${helpOutput}`).toMatch(
        '$ netlify [COMMAND]',
      )

      // Unlink

      const unlinkResult = await execa(cmd, [...args, 'unlink'], { env, all: true, reject: false })
      if (unlinkResult.exitCode !== 0) {
        throw new Error(
          `Unlink command failed: ${cmd} ${args.join(' ')} unlink\nExit code: ${unlinkResult.exitCode.toString()}\n\n${
            unlinkResult.all || ''
          }`,
        )
      }
      const unlinkOutput = unlinkResult.stdout
      expect(unlinkOutput, `Unlink command includes command context':\n\n${unlinkOutput}`).toContain(
        `Run ${cmd} netlify link to link it`,
      )
    } finally {
      if (!process.env.CI) {
        await fs.rm(cwd, { force: true, recursive: true, maxRetries: 3, retryDelay: 1000 })
      }
    }
  })
})
