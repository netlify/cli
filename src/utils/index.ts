// @ts-check
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const commandHelpers = require('./command-helpers.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'createStre... Remove this comment to see the full error message
const createStreamPromise = require('./create-stream-promise.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const deploy = require('./deploy/index.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'detectServ... Remove this comment to see the full error message
const detectServerSettings = require('./detect-server-settings.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const dev = require('./dev.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'env'.
const env = require('./env/index.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'execa'.
const execa = require('./execa.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const functions = require('./functions/index.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getGlobalC... Remove this comment to see the full error message
const getGlobalConfig = require('./get-global-config.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getRepoDat... Remove this comment to see the full error message
const getRepoData = require('./get-repo-data.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const ghAuth = require('./gh-auth.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const gitignore = require('./gitignore.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const liveTunnel = require('./live-tunnel.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'openBrowse... Remove this comment to see the full error message
const openBrowser = require('./open-browser.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'parseRawFl... Remove this comment to see the full error message
const parseRawFlags = require('./parse-raw-flags.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const proxy = require('./proxy.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'readRepoUR... Remove this comment to see the full error message
const readRepoURL = require('./read-repo-url.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'StateConfi... Remove this comment to see the full error message
const StateConfig = require('./state-config.cjs')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const telemetry = require('./telemetry/index.cjs')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
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
