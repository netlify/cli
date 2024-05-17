import { promises as fs } from 'fs'
import { resolve } from 'path'

import { isDirectoryAsync, isFileAsync } from '../../lib/fs.js'
import { getPathInProject } from '../../lib/settings.js'

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
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const getFunctionsDir = ({ config, options }, defaultValue) =>
  options.functions || config.dev?.functions || config.functionsDirectory || config.dev?.Functions || defaultValue

export const getFunctionsManifestPath = async ({ base, packagePath = '' }: { base: string; packagePath?: string }) => {
  const path = resolve(base, packagePath, getPathInProject(['functions', 'manifest.json']))
  const isFile = await isFileAsync(path)

  return isFile ? path : null
}

export const getFunctionsDistPath = async ({ base, packagePath = '' }: { base: string; packagePath?: string }) => {
  const path = resolve(base, packagePath, getPathInProject(['functions']))
  const isDirectory = await isDirectoryAsync(path)

  return isDirectory ? path : null
}

export const getFunctionsServePath = ({ base, packagePath = '' }: { base: string; packagePath?: string }) => {
  const path = resolve(base, packagePath, getPathInProject([SERVE_FUNCTIONS_FOLDER]))

  return path
}

/**
 * Retrieves the internal functions directory and creates it if ensureExists is provided
 */
export const getInternalFunctionsDir = async ({
  base,
  ensureExists,
  packagePath = '',
}: {
  base: string
  ensureExists?: boolean
  packagePath?: string
}) => {
  const path = resolve(base, packagePath, getPathInProject([INTERNAL_FUNCTIONS_FOLDER]))

  if (ensureExists) {
    await fs.mkdir(path, { recursive: true })
  }

  return path
}
