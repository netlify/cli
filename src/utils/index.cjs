// @ts-check
const commandHelpers = require('./command-helpers.cjs')
const deploy = require('./deploy/index.cjs')
const dev = require('./dev.cjs')
const env = require('./env/index.cjs')
const execa = require('./execa.cjs')
const getGlobalConfig = require('./get-global-config.cjs')
const ghAuth = require('./gh-auth.cjs')
const openBrowser = require('./open-browser.cjs')
const parseRawFlags = require('./parse-raw-flags.cjs')

module.exports = {
  ...commandHelpers,
  ...deploy,
  ...dev,
  ...env,
  ...ghAuth,
  ...openBrowser,
  ...parseRawFlags,
  execa,
  getGlobalConfig,
}
