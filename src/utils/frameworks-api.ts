import { mkdir } from 'fs/promises'
import { resolve } from 'node:path'

interface FrameworksAPIPath {
  path: string
  ensureExists: () => Promise<void>
}

/**
 * Returns an object containing the paths for all the operations of the
 * Frameworks API. Each key maps to an object containing a `path` property
 * with the path of the operation and a `ensureExists` methos that creates
 * the directory in case it doesn't exist.
 */
export const getFrameworksAPIPaths = (basePath: string, packagePath?: string) => {
  const root = resolve(basePath, packagePath || '', '.netlify/v1')
  const paths = {
    root,
    config: resolve(root, 'config.json'),
    functions: resolve(root, 'functions'),
    edgeFunctions: resolve(root, 'edge-functions'),
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
      },
    }),
    {} as Record<keyof typeof paths, FrameworksAPIPath>,
  )
}
