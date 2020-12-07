const os = require('os')
const path = require('path')

const NETLIFY_HOME = '.netlify'

const getHomeDirectory = () => path.join(os.homedir(), NETLIFY_HOME)

const getPathInHome = (paths) => {
  const pathInHome = path.join(getHomeDirectory(), ...paths)
  return pathInHome
}

const getPathInProject = (paths) => {
  const pathInProject = path.join(NETLIFY_HOME, ...paths)
  return pathInProject
}

module.exports = { getPathInHome, getPathInProject }
