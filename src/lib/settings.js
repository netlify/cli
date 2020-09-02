const path = require('path')
const os = require('os')

const NETLIFY_HOME = '.netlify'

const getHomeDirectory = () => {
  return path.join(os.homedir(), NETLIFY_HOME)
}

const getPathInHome = paths => {
  const pathInHome = path.join(getHomeDirectory(), ...paths)
  return pathInHome
}

module.exports = { getPathInHome }
