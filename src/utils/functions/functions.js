// @ts-check
const { stat } = require('fs/promises')
const { resolve } = require('path')

const { getPathInProject } = require('../../lib/settings')

const getFunctionsDir = ({ config, flags }, defaultValue) =>
  flags.functions ||
  (config.dev && config.dev.functions) ||
  config.functionsDirectory ||
  (config.dev && config.dev.Functions) ||
  defaultValue

const getFunctionsManifestPath = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions', 'manifest.json']))
  try {
    const stats = await stat(path)
    return stats.isFile() ? path : null
  } catch {
    return null;
  }
}

const getInternalFunctionsDir = async ({ base }) => {
  const path = resolve(base, getPathInProject(['functions-internal']))
  try {
    const stats = await stat(path)
    return stats.isDirectory() ? path : null
  } catch {
    return null;
  }

}

module.exports = { getFunctionsDir, getInternalFunctionsDir, getFunctionsManifestPath }
