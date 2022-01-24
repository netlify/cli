const { execSync } = require('child_process')
const process = require('process')

const { version } = require('../package.json')

/**
 * Checks if a package manager exists
 * @param {string} packageManager
 * @returns {boolean}
 */
const packageManagerExists = (packageManager) => {
  try {
    execSync(`${packageManager} --version`)
    return true
  } catch {
    return false
  }
}

const packageManagerConfig = {
  npm: {
    install: ['npm', ['install', 'netlify-cli@testing', `--registry=${process.env.E2E_TEST_REGISTRY}`]],
    lockFile: 'package-lock.json'
  },
  pnpm: {
    install: ['pnpm', ['add', `${process.env.E2E_TEST_REGISTRY}netlify-cli/-/netlify-cli-${version}.tgz`]],
    lockFile: 'pnpm-lock.yaml'
  },
  yarn: {
    install: ['yarn', ['add', 'netlify-cli@testing', `--registry=${process.env.E2E_TEST_REGISTRY}`]],
    lockFile: 'yarn.lock'
  },
}

module.exports = { packageManagerExists, packageManagerConfig }
