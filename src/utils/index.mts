// @ts-check

// @ts-expect-error TS(2307): Cannot find module './command-helpers.cjs' or its ... Remove this comment to see the full error message
import commandHelpers from './command-helpers.cjs'
// @ts-expect-error TS(2307): Cannot find module './create-stream-promise.cjs' o... Remove this comment to see the full error message
import createStreamPromise from './create-stream-promise.cjs'
// @ts-expect-error TS(2307): Cannot find module './deploy/index.cjs' or its cor... Remove this comment to see the full error message
import deploy from './deploy/index.cjs'
// @ts-expect-error TS(2307): Cannot find module './detect-server-settings.cjs' ... Remove this comment to see the full error message
import detectServerSettings from './detect-server-settings.cjs'
// @ts-expect-error TS(2307): Cannot find module './dev.cjs' or its correspondin... Remove this comment to see the full error message
import dev from './dev.cjs'
import * as env from './env/index.mjs'
// @ts-expect-error TS(2307): Cannot find module './execa.cjs' or its correspond... Remove this comment to see the full error message
import execa from './execa.cjs'
// @ts-expect-error TS(2307): Cannot find module './functions/index.cjs' or its ... Remove this comment to see the full error message
import functions from './functions/index.cjs'
// @ts-expect-error TS(2307): Cannot find module './get-global-config.cjs' or it... Remove this comment to see the full error message
import getGlobalConfig from './get-global-config.cjs'
// @ts-expect-error TS(2307): Cannot find module './get-repo-data.cjs' or its co... Remove this comment to see the full error message
import getRepoData from './get-repo-data.cjs'
// @ts-expect-error TS(2307): Cannot find module './gh-auth.cjs' or its correspo... Remove this comment to see the full error message
import ghAuth from './gh-auth.cjs'
// @ts-expect-error TS(2307): Cannot find module './gitignore.cjs' or its corres... Remove this comment to see the full error message
import gitignore from './gitignore.cjs'
// @ts-expect-error TS(2307): Cannot find module './live-tunnel.cjs' or its corr... Remove this comment to see the full error message
import liveTunnel from './live-tunnel.cjs'
// @ts-expect-error TS(2307): Cannot find module './open-browser.cjs' or its cor... Remove this comment to see the full error message
import openBrowser from './open-browser.cjs'
// @ts-expect-error TS(2307): Cannot find module './parse-raw-flags.cjs' or its ... Remove this comment to see the full error message
import parseRawFlags from './parse-raw-flags.cjs'
// @ts-expect-error TS(2307): Cannot find module './proxy.cjs' or its correspond... Remove this comment to see the full error message
import proxy from './proxy.cjs'
// @ts-expect-error TS(2307): Cannot find module './read-repo-url.cjs' or its co... Remove this comment to see the full error message
import readRepoURL from './read-repo-url.cjs'
// @ts-expect-error TS(2307): Cannot find module './state-config.cjs' or its cor... Remove this comment to see the full error message
import StateConfig from './state-config.cjs'
// @ts-expect-error TS(2307): Cannot find module './telemetry/index.cjs' or its ... Remove this comment to see the full error message
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
