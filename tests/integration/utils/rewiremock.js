// Once we switch to ESM modules do:
// https://github.com/theKashey/rewiremock#for-tses6esm-use-import
const { plugins } = require('rewiremock')
const rewiremock = require('rewiremock/node')

rewiremock.overrideEntryPoint(module)
rewiremock.addPlugin(plugins.relative)

module.exports = { rewiremock }
