const process = require('process')

const semver = require('semver')

const { engines } = require('../package.json')

const checkForSupportedNodeVersion = () => {
  const requiredVersion = engines.node
  const currentVersion = process.version

  if (!semver.satisfies(currentVersion, requiredVersion)) {
    console.log(`Netlify CLI requires NodeJS version ${requiredVersion} ; Current version is ${currentVersion}`)
    process.exit(1)
  }
}

checkForSupportedNodeVersion()
