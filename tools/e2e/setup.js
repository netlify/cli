import { appendFile, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join, normalize, sep } from 'path'
import { env } from 'process'
import { fileURLToPath } from 'url'

import execa from 'execa'
import getPort from 'get-port'
import pTimeout from 'p-timeout'
import { runServer } from 'verdaccio'

import { fileExistsAsync } from '../../dist/lib/fs.js'

const dir = dirname(fileURLToPath(import.meta.url))
const rootDir = normalize(join(dir, '../..'))

const VERDACCIO_TIMEOUT_MILLISECONDS = 60 * 1000
const START_PORT_RANGE = 5000
const END_PORT_RANGE = 5000

/**
 * Gets the verdaccio configuration
 */
const getVerdaccioConfig = () => ({
  // workaround
  // on v5 the `self_path` still exists and will be removed in v6 of verdaccio
  self_path: dir,
  storage: normalize(join(rootDir, '.verdaccio-storage')),
  web: { title: 'Test Registry' },
  max_body_size: '128mb',
  // Disable creation of users this is only meant for integration testing
  // where it should not be necessary to authenticate. Therefore no user is needed
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
    '**': {
      access: '$all',
      publish: 'noone',
      proxy: 'npmjs',
    },
  },
})

/**
 * Start verdaccio server
 * @returns {Promise<{ url: URL; storage: string; }>}
 */
const runVerdaccio = async (config, port) => {
  const app = await runServer(config)

  return new Promise((resolve, reject) => {
    app.listen(port, 'localhost', () => {
      resolve({ url: new URL(`http://localhost:${port}/`), storage: config.storage })
    })
    app.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Start verdaccio registry and store artifacts in a new temporary folder on the os
 * @returns {Promise<{ url: URL; storage: string; }>}
 */
export const startRegistry = async () => {
  const config = getVerdaccioConfig()

  // Remove netlify-cli from the verdaccio storage because we are going to publish it in a second
  await rm(join(config.storage, 'netlify-cli'), { force: true, recursive: true })

  // generate a random starting port to avoid race condition inside the promise when running a large
  // number in parallel
  const startPort = Math.floor(Math.random() * END_PORT_RANGE) + START_PORT_RANGE
  const freePort = await getPort({ host: 'localhost', port: startPort })

  return await pTimeout(runVerdaccio(config, freePort), VERDACCIO_TIMEOUT_MILLISECONDS, 'Starting Verdaccio timed out')
}

/**
 * Setups the environment with publishing the CLI to a intermediate registry
 * and creating a folder to start with.
 * @returns {
 *   registry: string,
 *   workspace: string,
 *   cleanup: () => Promise<void>
 * }
 */
export const setup = async () => {
  const { storage, url } = await startRegistry()
  const workspace = await mkdtemp(`${tmpdir()}${sep}e2e-test-`)

  const npmrc = join(rootDir, '.npmrc')
  const registryWithAuth = `//${url.hostname}:${url.port}/:_authToken=dummy`
  let backupNpmrc

  /** Cleans up everything */
  const cleanup = async () => {
    // remote temp folders
    await rm(workspace, { force: true, recursive: true })
  }

  env.npm_config_registry = url

  try {
    if (await fileExistsAsync(npmrc)) {
      backupNpmrc = await readFile(npmrc, 'utf-8')
      await appendFile(npmrc, registryWithAuth)
    } else {
      await writeFile(npmrc, registryWithAuth, 'utf-8')
    }

    // publish the CLI package to our registry
    await execa('npm', ['publish', `--registry=${url}`, '--tag=testing'], {
      stdio: env.DEBUG ? 'inherit' : 'ignore',
      cwd: rootDir,
    })

    // Reset the workspace, as npm publish does patch package.json etc
    await execa('git', ['checkout', '.'], { cwd: rootDir })
    await execa('npm', ['install', '--no-audit'], { cwd: rootDir })

    console.log(`------------------------------------------
  Published to ${url}
  Verdaccio: ${storage}
  Workspace: ${workspace}
------------------------------------------`)
  } catch (error_) {
    await cleanup()
    throw new Error(
      `npm publish failed for registry ${url.href}

${error_ instanceof Error ? error_.message : error_}`,
    )
  } finally {
    // restore .npmrc
    // eslint-disable-next-line unicorn/prefer-ternary
    if (backupNpmrc) {
      await writeFile(npmrc, backupNpmrc)
    } else {
      await rm(npmrc, { force: true, recursive: true })
    }
  }

  return {
    registry: url,
    workspace,
    cleanup,
  }
}
