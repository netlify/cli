// @ts-check
import { promises as fs } from 'fs'
import { resolve } from 'path'

import { isDirectoryAsync, isFileAsync } from '../../lib/fs.mjs'
import { getPathInProject } from '../../lib/settings.mjs'

export const INTERNAL_FUNCTIONS_FOLDER = 'functions-internal'
export const SERVE_FUNCTIONS_FOLDER = 'functions-serve'

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

export const getFunctionsDistPath = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions']))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

export const getInternalFunctionsDir = async ({ base, ensureExists }) => {
  const path = resolve(base, getPathInProject([INTERNAL_FUNCTIONS_FOLDER]))

  if (ensureExists) {
    await fs.mkdir(path, { recursive: true })
  }

  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}
