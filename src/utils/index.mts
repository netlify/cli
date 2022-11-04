// @ts-check
import * as env from './env/index.mjs'

// @ts-ignore
import commandHelpers from './command-helpers.cjs'
// @ts-ignore
import createStreamPromise from './create-stream-promise.cjs'
// @ts-ignore
import deploy from './deploy/index.cjs'
// @ts-ignore
import detectServerSettings from './detect-server-settings.cjs'
// @ts-ignore
import dev from './dev.cjs'
// @ts-ignore
import execa from './execa.cjs'
// @ts-ignore
import functions from './functions/index.cjs'
// @ts-ignore
import getGlobalConfig from './get-global-config.cjs'
// @ts-ignore
import getRepoData from './get-repo-data.cjs'
// @ts-ignore
import ghAuth from './gh-auth.cjs'
// @ts-ignore
import gitignore from './gitignore.cjs'
// @ts-ignore
import liveTunnel from './live-tunnel.cjs'
// @ts-ignore
import openBrowser from './open-browser.cjs'
// @ts-ignore
import parseRawFlags from './parse-raw-flags.cjs'
// @ts-ignore
import proxy from './proxy.cjs'
// @ts-ignore
import readRepoURL from './read-repo-url.cjs'
// @ts-ignore
import StateConfig from './state-config.cjs'
// @ts-ignore
import telemetry from './telemetry/index.cjs'

export default {
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
