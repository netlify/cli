// @ts-check
import { readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { cwd } from 'process'
import { pathToFileURL } from 'url'

import { warn } from '../../utils/command-helpers.mjs'
import { getPathInProject } from '../settings.cjs'

import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.mjs'

/**
 * Reads an import map from a path and returns the parsed data, if it exists
 * and is valid. Otherwise, it returns null.
 *
 * @param {string} importMapPath
 * @returns {Promise<object | null>}
 */
const getImportMap = async (importMapPath) => {
  try {
    const data = await readFile(importMapPath)
    const importMap = JSON.parse(data)

    return importMap
  } catch {
    warn(`Could not read the import map file for Edge Functions at ${importMapPath}`)

    return null
  }
}

export const getInternalFunctions = async () => {
  const path = join(cwd(), getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]))

  try {
    await stat(path)
  } catch {
    return {
      functions: [],
      path: null,
    }
  }

  try {
    const manifestPath = join(path, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath))

    if (manifest.version !== 1) {
      throw new Error('Unsupported manifest format')
    }

    const data = {
      functions: manifest.functions,
      path,
    }

    if (manifest.import_map) {
      const importMapPath = resolve(dirname(manifestPath), manifest.import_map)
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
      path,
    }
  }
}
