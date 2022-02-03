import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { env } from 'process'
import { fileURLToPath } from 'url'

const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'))

/**
 * Checks if a package manager exists
 * @param {string} packageManager
 * @returns {boolean}
 */
export const packageManagerExists = (packageManager) => {
  try {
    execSync(`${packageManager} --version`)
    return true
  } catch {
    return false
  }
}

export const packageManagerConfig = {
  npm: {
    install: ['npm', ['install', 'netlify-cli@testing', `--registry=${env.E2E_TEST_REGISTRY}`]],
    lockFile: 'package-lock.json',
  },
  pnpm: {
    install: ['pnpm', ['add', `${env.E2E_TEST_REGISTRY}netlify-cli/-/netlify-cli-${version}.tgz`]],
    lockFile: 'pnpm-lock.yaml',
  },
  yarn: {
    install: ['yarn', ['add', 'netlify-cli@testing', `--registry=${env.E2E_TEST_REGISTRY}`]],
    lockFile: 'yarn.lock',
  },
}
