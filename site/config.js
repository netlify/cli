import { join } from 'path'
import { fileURLToPath } from 'url'

export const rootDir = fileURLToPath(new URL('..', import.meta.url))

export const docs = {
  srcPath: join(rootDir, 'docs'),
  outputPath: join(rootDir, 'site/src'),
}
