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

/**
 * Returns an object containing the paths for all the operations of the
 * Frameworks API. Each key maps to an object containing a `path` property with
 * the path of the operation, an `exists` method that returns whether the path
 * exists, and an `ensureExists` method that creates it in case it doesn't.
 */
export const getFrameworksAPIPaths = (basePath: string, packagePath?: string) => {
  const root = resolve(basePath, packagePath || '', '.netlify/v1')
  const edgeFunctions = resolve(root, 'edge-functions')
  const paths = {
    root,
    config: resolve(root, 'config.json'),
    functions: resolve(root, 'functions'),
    edgeFunctions,
    edgeFunctionsImportMap: resolve(edgeFunctions, 'import_map.json'),
    blobs: resolve(root, 'blobs'),
  }

  return Object.entries(paths).reduce(
    (acc, [name, path]) => ({
      ...acc,
      [name]: {
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
      },
    }),
    {} as Record<keyof typeof paths, FrameworksAPIPath>,
  )
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

  return mergeConfigs([frameworksAPIConfig, config], { concatenateArrays: true }) as NetlifyOptions['config']
}
