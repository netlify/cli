const { mkdtemp } = require('fs').promises
const { appendFileSync, existsSync, readFileSync, writeFileSync } = require('fs')
const { homedir, tmpdir } = require('os')
const { join, sep } = require('path')
const process = require('process')

const execa = require('execa')
const getPort = require('get-port')
const startVerdaccio = require('verdaccio').default

const { rmdirRecursiveAsync } = require('../../src/lib/fs')

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
    },
  },
  packages: {
    '@*/*': {
      access: '$all',
      publish: 'noone',
      proxy: 'npmjs'
    },
    'netlify-cli': {
      access: '$all',
      publish: '$all',
    },
    '**': {
      access: '$all',
      publish: 'noone',
      proxy: 'npmjs'
    },
  },
})

/**
 * Start verdaccio registry and store artifacts in a new temporary folder on the os
 * @returns {Promise<{ url: URL; storage: string; }>}
 */
const startRegistry = async () => {
  // generate a random starting port to avoid race condition inside the promise when running a large
  // number in parallel
  const startPort = Math.floor(Math.random() * END_PORT_RANGE) + START_PORT_RANGE
  const freePort = await getPort({ host: 'localhost', port: startPort })
  const storage = await mkdtemp(`${tmpdir()}${sep}verdaccio-`)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('Starting Verdaccio Timed out'))
    }, VERDACCIO_TIMEOUT_MILLISECONDS)

    startVerdaccio(getVerdaccioConfig(storage), freePort, storage, '1.0.0', 'verdaccio', (webServer, { port }) => {
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
const setup = async () => {
  const { storage, url } = await startRegistry()
  const workspace = await mkdtemp(`${tmpdir()}${sep}e2e-test-`)

  const npmrc = join(homedir(), '.npmrc')
  const registryWithAuth = `//${url.hostname}:${url.port}/:_authToken=dummy`
  let backupNpmrc

  /** Cleans up everything */
  const cleanup = async () => {
    // restore ~/.npmrc
    if (backupNpmrc) {
      writeFileSync(npmrc, backupNpmrc)
    } else {
      await rmdirRecursiveAsync(npmrc)
    }
    // remote temp folders
    await rmdirRecursiveAsync(storage)
    await rmdirRecursiveAsync(workspace)
  }

  try {
    if (existsSync(npmrc)) {
      backupNpmrc = readFileSync(npmrc, 'utf-8')
      appendFileSync(npmrc, registryWithAuth)
    } else {
      writeFileSync(npmrc, registryWithAuth, 'utf-8')
    }

    // publish the CLI package to our registry
    await execa('npm', ['publish', `--registry=${url}`, '--tag=testing', process.cwd()], {
      stdio: process.env.DEBUG ? 'inherit' : 'ignore',
    })

    console.log(`------------------------------------------
  Published to ${url}
  Verdaccio: ${storage}
  Workspace: ${workspace}
------------------------------------------`)

    writeFileSync(join(workspace, '.npmrc'), registryWithAuth, 'utf-8')
  } catch (_error) {
    await cleanup()
    throw _error
  }

  return {
    registry: url,
    workspace,
    cleanup,
  }
}

module.exports = { startRegistry, setup }
