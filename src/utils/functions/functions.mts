// @ts-check

const { resolve } = require('path')


const { isDirectoryAsync, isFileAsync } = require('../../lib/fs.mjs')

const { getPathInProject } = require('../../lib/settings.mjs')

/**
 * retrieves the function directory out of the flags or config
 * @param {object} param
 * @param {object} param.config
 * @param {import('commander').OptionValues} param.options The options from the commander
 * @param {string} [defaultValue]
 * @returns {string}
 */

const getFunctionsDir = ({
  config,
  options

}: $TSFixMe, defaultValue: $TSFixMe) =>
  options.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue


const getFunctionsManifestPath = async ({
  base

}: $TSFixMe) => {
  const path = resolve(base, getPathInProject(['functions', 'manifest.json']))
  const isFile = await isFileAsync(path)

  return isFile ? path : null
}


const getInternalFunctionsDir = async ({
  base

}: $TSFixMe) => {
  const path = resolve(base, getPathInProject(['functions-internal']))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

export default { getFunctionsDir, getInternalFunctionsDir, getFunctionsManifestPath }
