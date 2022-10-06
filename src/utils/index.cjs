// @ts-check
const commandHelpers = require('./command-helpers.cjs')
const createStreamPromise = require('./create-stream-promise.cjs')
const deploy = require('./deploy/index.cjs')
const detectServerSettings = require('./detect-server-settings.cjs')
const dev = require('./dev.cjs')
const env = require('./env/index.cjs')
const execa = require('./execa.cjs')
const functions = require('./functions/index.cjs')
const getGlobalConfig = require('./get-global-config.cjs')
const getRepoData = require('./get-repo-data.cjs')
const ghAuth = require('./gh-auth.cjs')
const gitignore = require('./gitignore.cjs')
const liveTunnel = require('./live-tunnel.cjs')
const openBrowser = require('./open-browser.cjs')
const parseRawFlags = require('./parse-raw-flags.cjs')
const proxy = require('./proxy.cjs')
const readRepoURL = require('./read-repo-url.cjs')
const StateConfig = require('./state-config.cjs')
const telemetry = require('./telemetry/index.cjs')

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
