import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const rootDir = fileURLToPath(new URL('..', import.meta.url))

export const docs = {
  srcPath: join(rootDir, 'docs'),
  outputPath: join(rootDir, 'site/src/content/docs'),
}
