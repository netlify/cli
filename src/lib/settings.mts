// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'os'.
const os = require('os')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getLegacyP... Remove this comment to see the full error message
const getLegacyPathInHome = (paths: $TSFixMe) => {
  const pathInHome = path.join(os.homedir(), NETLIFY_HOME, ...paths)
  return pathInHome
}

/**
 * get a global path on the os base path
 * @param {string[]} paths
 * @returns {string}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInH... Remove this comment to see the full error message
const getPathInHome = (paths: $TSFixMe) => {
  const pathInHome = path.join(OSBasedPaths.config, ...paths)
  return pathInHome
}

/**
 * get a path inside the project folder
 * @param {string[]} paths
 * @returns {string}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const getPathInProject = (paths: $TSFixMe) => {
  const pathInProject = path.join(NETLIFY_HOME, ...paths)
  return pathInProject
}

module.exports = { getLegacyPathInHome, getPathInHome, getPathInProject }
