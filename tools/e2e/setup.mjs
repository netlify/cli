import { appendFileSync, existsSync, promises, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, sep } from 'path'
import { cwd, env } from 'process'
import { fileURLToPath } from 'url'

import del from 'del'
import execa from 'execa'
import getPort from 'get-port'
import verdaccio from 'verdaccio'

// TODO: remove this once `../../src/lib/fs.js` is an esm module as well
const rmdirRecursiveAsync = async (path) => {
  await del(path, { force: true })
}

const { mkdtemp } = promises

// eslint-disable-next-line no-magic-numbers
const VERDACCIO_TIMEOUT_MILLISECONDS = 60 * 1000
const START_PORT_RANGE = 5000
const END_PORT_RANGE = 5000

/**
 * Gets the verdaccio configuration
 * @param {string} storage The location where the artifacts are stored
 */
const getVerdaccioConfig = (storage) => ({
  storage,
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
 * Start verdaccio registry and store artifacts in a new temporary folder on the os
 * @returns {Promise<{ url: URL; storage: string; }>}
 */
export const startRegistry = async () => {
  // generate a random starting port to avoid race condition inside the promise when running a large
  // number in parallel
  const startPort = Math.floor(Math.random() * END_PORT_RANGE) + START_PORT_RANGE
  const freePort = await getPort({ host: 'localhost', port: startPort })
  const storage = fileURLToPath(new URL('../../.verdaccio-storage', import.meta.url))

  // Remove netlify-cli from the verdaccio storage because we are going to publish it in a second
  await rmdirRecursiveAsync(join(storage, 'netlify-cli'))

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Starting Verdaccio Timed out'))
    }, VERDACCIO_TIMEOUT_MILLISECONDS)

    verdaccio.default(getVerdaccioConfig(storage), freePort, storage, '1.0.0', 'verdaccio', (webServer, { port }) => {
      webServer.listen(port, 'localhost', () => {
        resolve({ url: new URL(`http://localhost:${port}/`), storage })
      })
    })
  })
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

  const npmrc = fileURLToPath(new URL('../../.npmrc', import.meta.url))
  const registryWithAuth = `//${url.hostname}:${url.port}/:_authToken=dummy`
  let backupNpmrc

  /** Cleans up everything */
  const cleanup = async () => {
    // remote temp folders
    await rmdirRecursiveAsync(workspace)
  }

  env.npm_config_registry = url

  try {
    if (existsSync(npmrc)) {
      backupNpmrc = readFileSync(npmrc, 'utf-8')
      appendFileSync(npmrc, registryWithAuth)
    } else {
      writeFileSync(npmrc, registryWithAuth, 'utf-8')
    }

    // publish the CLI package to our registry
    await execa('npm', ['publish', `--registry=${url}`, '--tag=testing', cwd()], {
      stdio: env.DEBUG ? 'inherit' : 'ignore',
    })

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
    if (backupNpmrc) {
      writeFileSync(npmrc, backupNpmrc)
    } else {
      await rmdirRecursiveAsync(npmrc)
    }
  }

  return {
    registry: url,
    workspace,
    cleanup,
  }
}
