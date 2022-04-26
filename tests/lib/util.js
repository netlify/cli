const process = require('process')

const semver = require('semver')

const getLocalClientIP = () => {
  const version = process.version.slice(1)
  const ip = semver.gte(version, '17.0.0') ? '::1' : '127.0.0.1'

  return ip
}

const getLocalXForwardFor = () => {
  const version = process.version.slice(1)
  const ip = semver.gte(version, '17.0.0') ? '::1' : '::ffff:127.0.0.1'

  return ip
}

module.exports = { getLocalClientIP, getLocalXForwardFor }
