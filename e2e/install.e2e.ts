import http from 'node:http'
import os from 'node:os'
import events from 'node:events'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { platform } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import execa from 'execa'
import { runServer } from 'verdaccio'
import { describe, expect, it } from 'vitest'
import createDebug from 'debug'
import picomatch from 'picomatch'

import pkg from '../package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const distDir = path.join(projectRoot, 'dist')
const tempdirPrefix = 'netlify-cli-e2e-test--'

const debug = createDebug('netlify-cli:e2e')
const isNodeModules = picomatch('**/node_modules/**')
const isNotNodeModules = (target: string) => !isNodeModules(target)

const itWithMockNpmRegistry = it.extend<{ registry: { address: string; cwd: string } }>({
  registry: async (
    // Vitest requires this argument is destructured even if no properties are used
    // eslint-disable-next-line no-empty-pattern
    {},
    use,
  ) => {
    // Add timeout protection for registry setup
    const setupTimeout = setTimeout(() => {
      throw new Error('Registry setup timed out after 60 seconds')
    }, 60000)
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

    const verdaccioStorageDir = await fs.mkdtemp(path.join(os.tmpdir(), `${tempdirPrefix}verdaccio-storage`))
    const server: http.Server = (await runServer(
      // @ts-expect-error(ndhoule): Verdaccio's types are incorrect
      {
        self_path: __dirname,
        storage: verdaccioStorageDir,
        web: { title: 'Test Registry' },
        max_body_size: '128mb',
        // Disable user registration
        max_users: -1,
        logs: { level: 'fatal' },
        uplinks: {
          npmjs: {
            url: 'https://registry.npmjs.org/',
            maxage: '1d',
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
      },
    )) as http.Server

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

    // The CLI publishing process modifies the workspace, so copy it to a temporary directory. This
    // lets us avoid contaminating the user's workspace when running these tests locally.
    const publishWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), `${tempdirPrefix}publish-workspace`))
    await fs.cp(projectRoot, publishWorkspace, {
      recursive: true,
      verbatimSymlinks: true,
      // At this point, the project is built. As long as we limit the prepublish script to built-
      // ins, node_modules are not be necessary to publish the package.
      filter: isNotNodeModules,
    })
    await fs.writeFile(
      path.join(publishWorkspace, '.npmrc'),
      `//${registryURL.hostname}:${registryURL.port}/:_authToken=dummy`,
    )
    await execa('npm', ['publish', `--registry=${registryURL.toString()}`, '--tag=testing'], {
      cwd: publishWorkspace,
      stdio: debug.enabled ? 'inherit' : 'ignore',
    })

    // Publishing `netlify` package with improved Windows support
    try {
      if (platform() === 'win32') {
        // Use node directly on Windows to avoid script execution issues
        await execa('node', [path.resolve(projectRoot, 'scripts/netlifyPackage.js')], {
          cwd: publishWorkspace,
          stdio: debug.enabled ? 'inherit' : 'ignore',
          timeout: 30000,
        })
      } else {
        await execa.node(path.resolve(projectRoot, 'scripts/netlifyPackage.js'), {
          cwd: publishWorkspace,
          stdio: debug.enabled ? 'inherit' : 'ignore',
          timeout: 30000,
        })
      }
      await execa('npm', ['publish', `--registry=${registryURL.toString()}`, '--tag=testing'], {
        cwd: publishWorkspace,
        stdio: debug.enabled ? 'inherit' : 'ignore',
        timeout: 60000,
      })
    } catch (error) {
      debug('Failed to publish netlify package:', error)
      // Continue with tests even if netlify package publication fails
    }

    await fs.rm(publishWorkspace, { force: true, recursive: true })

    const testWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), tempdirPrefix))
    await use({
      address: registryURL.toString(),
      cwd: testWorkspace,
    })

    await Promise.all([
      events.once(server, 'close'),
      server.close(),
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      server.closeAllConnections(),
    ])
    await fs.rm(testWorkspace, { force: true, recursive: true })
    await fs.rm(verdaccioStorageDir, { force: true, recursive: true })
    clearTimeout(setupTimeout)
  },
})

type Test = { packageName: string }
type InstallTest = Test & { install: [cmd: string, args: string[]]; lockfile: string }
type RunTest = Test & { run: [cmd: string, args: string[]] }

const installTests: [packageManager: string, config: InstallTest][] = [
  [
    'npm',
    {
      packageName: 'netlify-cli',
      install: ['npm', ['install', 'netlify-cli@testing']],
      lockfile: 'package-lock.json',
    },
  ],
  [
    'pnpm',
    {
      packageName: 'netlify-cli',
      install: ['pnpm', ['add', 'netlify-cli@testing']],
      lockfile: 'pnpm-lock.yaml',
    },
  ],
  [
    'yarn',
    {
      packageName: 'netlify-cli',
      install: ['yarn', ['add', 'netlify-cli@testing']],
      lockfile: 'yarn.lock',
    },
  ],
]

describe.each(installTests)('%s → installs the cli and runs commands without errors', (_, config) => {
  itWithMockNpmRegistry('runs the commands without errors', async ({ registry }) => {
    // Install

    const cwd = registry.cwd
    await execa(...config.install, {
      cwd,
      env: { npm_config_registry: registry.address },
      stdio: debug.enabled ? 'inherit' : 'ignore',
      timeout: 300000, // 5 minute timeout for installation
    })

    expect(
      existsSync(path.join(cwd, config.lockfile)),
      `Generated lock file ${config.lockfile} does not exist in ${cwd}`,
    ).toBe(true)

    const binary = path.resolve(path.join(cwd, `./node_modules/.bin/netlify${platform() === 'win32' ? '.cmd' : ''}`))

    // Help

    const helpOutput = (await execa(binary, ['help'], { cwd })).stdout

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

    const unlinkOutput = (await execa(binary, ['unlink'], { cwd })).stdout
    expect(unlinkOutput, `Unlink command includes command context':\n\n${unlinkOutput}`).toContain(
      `Run netlify link to link it`,
    )
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

describe.each(runTests)('%s → runs cli commands without errors', (_, config) => {
  itWithMockNpmRegistry('runs commands without errors', async ({ registry }) => {
    const [cmd, args] = config.run
    const env = {
      npm_config_registry: registry.address,
    }

    // Install

    await execa(cmd, [...args], { env })

    // Help

    const helpOutput = (await execa(cmd, [...args, 'help'], { env })).stdout

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

    const unlinkOutput = (await execa(cmd, [...args, 'unlink'], { env })).stdout
    expect(unlinkOutput, `Unlink command includes command context':\n\n${unlinkOutput}`).toContain(
      `Run ${cmd} netlify link to link it`,
    )
  })
})
