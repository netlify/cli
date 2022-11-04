// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fs'.
const { promises: fs } = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'cwd'.
const { cwd } = require('process')
const { pathToFileURL } = require('url')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('../../utils/command-helpers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../settings.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'INTERNAL_E... Remove this comment to see the full error message
const { INTERNAL_EDGE_FUNCTIONS_FOLDER } = require('./consts.cjs')

/**
 * Reads an import map from a path and returns the parsed data, if it exists
 * and is valid. Otherwise, it returns null.
 *
 * @param {string} importMapPath
 * @returns {Promise<object | null>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getImportMap = async (importMapPath: $TSFixMe) => {
  try {
    const data = await fs.readFile(importMapPath)
    const importMap = JSON.parse(data)

    return importMap
  } catch {
    warn(`Could not read the import map file for Edge Functions at ${importMapPath}`)

    return null
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getInterna... Remove this comment to see the full error message
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
          importMap: {
            baseURL: pathToFileURL(importMapPath),
            ...importMap,
          },
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
