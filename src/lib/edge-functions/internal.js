// @ts-check
const { promises: fs } = require('fs')
const path = require('path')
const { cwd } = require('process')

const { warn } = require('../../utils/command-helpers')
const { getPathInProject } = require('../settings')

const { INTERNAL_EDGE_FUNCTIONS_FOLDER } = require('./consts')

/**
 * Reads an import map from a path and returns the parsed data, if it exists
 * and is valid. Otherwise, it returns null.
 *
 * @param {string} importMapPath
 * @returns {Promise<object | null>}
 */
const getImportMap = async (importMapPath) => {
  try {
    const data = await fs.readFile(importMapPath)
    const importMap = JSON.parse(data)

    return importMap
  } catch {
    warn(`Could not read the import map file for Edge Functions at ${importMapPath}`)

    return null
  }
}

const getInternalFunctions = async () => {
  const internalPath = path.join(cwd(), getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]))

  try {
    const stats = await fs.stat(internalPath)

    if (!stats.isDirectory()) {
      throw new Error('Path is not a directory')
    }

    const manifestPath = path.join(internalPath, 'manifest.json')
    // eslint-disable-next-line import/no-dynamic-require, n/global-require
    const manifest = require(manifestPath)

    if (manifest.version !== 1) {
      throw new Error('Unsupported manifest format')
    }

    const data = {
      functions: manifest.functions,
      path: internalPath,
    }

    if (manifest.import_map) {
      const importMapPath = path.resolve(path.dirname(manifestPath), manifest.import_map)
      const importMap = await getImportMap(importMapPath)

      if (importMap !== null) {
        return {
          ...data,
          importMap,
        }
      }
    }

    return data
  } catch {
    return {
      functions: [],
      path: null,
    }
  }
}

module.exports = { getInternalFunctions }
