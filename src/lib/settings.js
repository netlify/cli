const os = require('os')
const path = require('path')

const envPaths = require('env-paths')

const OSBasedPaths = envPaths('netlify', { suffix: '' })
const NETLIFY_HOME = '.netlify'

// Deprecated method to get netlify's home config - ~/.netlify/...
const getLegacyPathInHome = (paths) => {
  const pathInHome = path.join(os.homedir(), NETLIFY_HOME, ...paths)
  return pathInHome
}

const getPathInHome = (paths) => {
  const pathInHome = path.join(OSBasedPaths.config, ...paths)
  return pathInHome
}

const getPathInProject = (paths) => {
  const pathInProject = path.join(NETLIFY_HOME, ...paths)
  return pathInProject
}

module.exports = { getLegacyPathInHome, getPathInHome, getPathInProject }
