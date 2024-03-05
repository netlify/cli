import { execSync } from 'child_process'

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
    install: ['npm', ['install', 'netlify-cli@testing']],
    lockFile: 'package-lock.json',
  },
  pnpm: {
    install: ['pnpm', ['add', 'netlify-cli@testing']],
    lockFile: 'pnpm-lock.yaml',
  },
  yarn: {
    install: ['yarn', ['add', 'netlify-cli@testing']],
    lockFile: 'yarn.lock',
  },
}
