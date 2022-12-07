/* eslint-disable import/no-namespace */
import * as go from './go/index.mjs'
import * as js from './js/index.mjs'
import * as rust from './rust/index.mjs'
/* eslint-enable import/no-namespace */
/**
 * @callback BuildFunction
 * @param {object} func
 * @returns {Promise<{srcFiles: string[], buildPath?: string}>}
 */

/**
 * @callback GetBuildFunction
 * @param  {{ config: object, context: object, errorExit: function, func: object, functionsDirectory: string, projectRoot: string }} params
 * @returns {Promise<BuildFunction>}
 */

/**
 * @callback InvokeFunction
 * @param  {{ context: object, event: object, func: object, timeout: number }} params
 * @returns {Promise<{ body: object, statusCode: number }>}
 */

/**
 * @callback OnDirectoryScanFunction
 * @param  {{ directory: string }} params
 * @returns {Promise<undefined>}
 */

/**
 * @callback OnRegisterFunction
 * @param  {object} func
 * @returns {object|null}
 */

/**
 * @typedef {object} Runtime
 * @property {GetBuildFunction} getBuildFunction
 * @property {InvokeFunction} invokeFunction
 * @property {OnDirectoryScanFunction} [onDirectoryScan]
 * @property {OnRegisterFunction} [onRegister]
 * @property {string} name
 */

const runtimes = {
  [go.name]: go,
  [js.name]: js,
  [rust.name]: rust,
}

export default runtimes
