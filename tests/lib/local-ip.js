const process = require('process')

const semver = require('semver')

const version = process.version.slice(1)

const [clientIP, originalIP] = ['127.0.0.1', '::ffff:127.0.0.1'];

module.exports = { clientIP, originalIP }
