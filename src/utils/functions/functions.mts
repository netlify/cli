// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'resolve'.
const { resolve } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isDirector... Remove this comment to see the full error message
const { isDirectoryAsync, isFileAsync } = require('../../lib/fs.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../../lib/settings.cjs')

/**
 * retrieves the function directory out of the flags or config
 * @param {object} param
 * @param {object} param.config
 * @param {import('commander').OptionValues} param.options The options from the commander
 * @param {string} [defaultValue]
 * @returns {string}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getFunctio... Remove this comment to see the full error message
const getFunctionsDir = ({
  config,
  options
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe, defaultValue: $TSFixMe) =>
  options.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getFunctio... Remove this comment to see the full error message
const getFunctionsManifestPath = async ({
  base
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const path = resolve(base, getPathInProject(['functions', 'manifest.json']))
  const isFile = await isFileAsync(path)

  return isFile ? path : null
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getInterna... Remove this comment to see the full error message
const getInternalFunctionsDir = async ({
  base
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const path = resolve(base, getPathInProject(['functions-internal']))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

module.exports = { getFunctionsDir, getInternalFunctionsDir, getFunctionsManifestPath }
