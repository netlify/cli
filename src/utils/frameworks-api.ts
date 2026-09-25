import { access, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { mergeConfigs } from '@netlify/config'

import type { NetlifyOptions } from '../commands/types.js'

interface FrameworksAPIPath {
  path: string
  ensureExists: () => Promise<void>
  exists: () => Promise<boolean>
}

export type FrameworksAPIPaths = ReturnType<typeof getFrameworksAPIPaths>

const createFrameworksAPIPath = (path: string): FrameworksAPIPath => ({
  path,
  ensureExists: async () => {
    await mkdir(path, { recursive: true })
  },
  exists: async () => {
    try {
      await access(path)

      return true
    } catch {
      return false
    }
  },
})

/**
 * Returns an object containing the paths for all the operations of the
 * Frameworks API. Each key maps to an object containing a `path` property with
 * the path of the operation, an `exists` method that returns whether the path
 * exists, and an `ensureExists` method that creates it in case it doesn't.
 */
export const getFrameworksAPIPaths = (basePath: string, packagePath?: string) => {
  const root = resolve(basePath, packagePath || '', '.netlify/v1')
  const edgeFunctions = resolve(root, 'edge-functions')

  return {
    root: createFrameworksAPIPath(root),
    config: createFrameworksAPIPath(resolve(root, 'config.json')),
    functions: createFrameworksAPIPath(resolve(root, 'functions')),
    edgeFunctions: createFrameworksAPIPath(edgeFunctions),
    edgeFunctionsImportMap: createFrameworksAPIPath(resolve(edgeFunctions, 'import_map.json')),
    blobs: createFrameworksAPIPath(resolve(root, 'blobs')),
  }
}

/**
 * Merges a config object with any config options from the Frameworks API.
 */
export const getFrameworksAPIConfig = async (config: NetlifyOptions['config'], frameworksAPIConfigPath: string) => {
  let frameworksAPIConfigFile: string | undefined

  try {
    frameworksAPIConfigFile = await readFile(frameworksAPIConfigPath, 'utf8')
  } catch {
    return config
  }

  const frameworksAPIConfig = JSON.parse(frameworksAPIConfigFile)

  // FIXME(@netlify/config): `mergeConfigs()` returns `object`
  return mergeConfigs([frameworksAPIConfig, config], { concatenateArrays: true }) as NetlifyOptions['config']
}
