// @ts-check
import { resolve } from 'path'

import { isDirectoryAsync, isFileAsync } from '../../lib/fs.cjs'
import { getPathInProject } from '../../lib/settings.cjs'

export const INTERNAL_FUNCTIONS_FOLDER = 'functions-internal'

/**
 * retrieves the function directory out of the flags or config
 * @param {object} param
 * @param {object} param.config
 * @param {import('commander').OptionValues} param.options The options from the commander
 * @param {string} [defaultValue]
 * @returns {string}
 */
export const getFunctionsDir = ({ config, options }, defaultValue) =>
  options.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

export const getFunctionsManifestPath = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions', 'manifest.json']))
  const isFile = await isFileAsync(path)

  return isFile ? path : null
}

export const getInternalFunctionsDir = async ({ base }) => {
  const path = resolve(base, getPathInProject([INTERNAL_FUNCTIONS_FOLDER]))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}
