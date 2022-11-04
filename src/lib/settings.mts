
const os = require('os')

const path = require('path')

const envPaths = require('env-paths')

const OSBasedPaths = envPaths('netlify', { suffix: '' })
const NETLIFY_HOME = '.netlify'

/**
 * Deprecated method to get netlify's home config - ~/.netlify/...
 * @deprecated
 * @param {string[]} paths
 * @returns {string}
 */

const getLegacyPathInHome = (paths: $TSFixMe) => {
  const pathInHome = path.join(os.homedir(), NETLIFY_HOME, ...paths)
  return pathInHome
}

/**
 * get a global path on the os base path
 * @param {string[]} paths
 * @returns {string}
 */

const getPathInHome = (paths: $TSFixMe) => {
  const pathInHome = path.join(OSBasedPaths.config, ...paths)
  return pathInHome
}

/**
 * get a path inside the project folder
 * @param {string[]} paths
 * @returns {string}
 */

const getPathInProject = (paths: $TSFixMe) => {
  const pathInProject = path.join(NETLIFY_HOME, ...paths)
  return pathInProject
}

export default { getLegacyPathInHome, getPathInHome, getPathInProject }
