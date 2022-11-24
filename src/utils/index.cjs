// @ts-check
const commandHelpers = require('./command-helpers.cjs')
const deploy = require('./deploy/index.cjs')
const detectServerSettings = require('./detect-server-settings.cjs')
const dev = require('./dev.cjs')
const env = require('./env/index.cjs')
const execa = require('./execa.cjs')
const functions = require('./functions/index.cjs')
const getGlobalConfig = require('./get-global-config.cjs')
const getRepoData = require('./get-repo-data.cjs')
const ghAuth = require('./gh-auth.cjs')
const openBrowser = require('./open-browser.cjs')
const parseRawFlags = require('./parse-raw-flags.cjs')

module.exports = {
  ...commandHelpers,
  ...deploy,
  ...detectServerSettings,
  ...dev,
  ...env,
  ...functions,
  ...getRepoData,
  ...ghAuth,
  ...openBrowser,
  ...parseRawFlags,
  execa,
  getGlobalConfig,
}
