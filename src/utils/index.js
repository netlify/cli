// @ts-check
const commandHelpers = require('./command-helpers')
const createStreamPromise = require('./create-stream-promise')
const deploy = require('./deploy')
const detectServerSettings = require('./detect-server-settings')
const dev = require('./dev')
const env = require('./env')
const execa = require('./execa')
const functions = require('./functions')
const getGlobalConfig = require('./get-global-config')
const getRepoData = require('./get-repo-data')
const ghAuth = require('./gh-auth')
const gitignore = require('./gitignore')
const liveTunnel = require('./live-tunnel')
const openBrowser = require('./open-browser')
const parseRawFlags = require('./parse-raw-flags')
const proxy = require('./proxy')
const readRepoURL = require('./read-repo-url')
const StateConfig = require('./state-config')
const telemetry = require('./telemetry')

module.exports = {
  ...commandHelpers,
  ...createStreamPromise,
  ...deploy,
  ...detectServerSettings,
  ...dev,
  ...env,
  ...functions,
  ...getRepoData,
  ...ghAuth,
  ...gitignore,
  ...liveTunnel,
  ...openBrowser,
  ...parseRawFlags,
  ...proxy,
  ...readRepoURL,
  ...StateConfig,
  ...telemetry,
  execa,
  getGlobalConfig,
}
