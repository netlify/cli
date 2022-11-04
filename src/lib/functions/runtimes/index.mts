const go = require('./go/index.cjs')
const js = require('./js/index.cjs')
const rust = require('./rust/index.cjs')

/**
 * @callback BuildFunction
 * @param {object} func
 * @returns {Promise<{srcFiles: string[], buildPath?: string>}
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'runtimes'.
const runtimes = [js, go, rust].reduce((res, runtime) => ({ ...res, [runtime.name]: runtime }), {})

module.exports = runtimes
