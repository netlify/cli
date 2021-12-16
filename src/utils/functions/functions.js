// @ts-check
const { resolve } = require('path')

const { isDirectoryAsync, isFileAsync } = require('../../lib/fs')
const { getPathInProject } = require('../../lib/settings')

/**
 * retrieves the function directory out of the flags or config
 * @param {object} param
 * @param {object} param.config
 * @param {import('commander').OptionValues} param.options The options from the commander
 * @param {string} [defaultValue]
 * @returns {string}
 */
const getFunctionsDir = ({ config, options }, defaultValue) =>
  options.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getFunctionsManifestPath = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions', 'manifest.json']))
  const isFile = await isFileAsync(path)

  return isFile ? path : null
}

const getInternalFunctionsDir = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions-internal']))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

module.exports = { getFunctionsDir, getInternalFunctionsDir, getFunctionsManifestPath }
