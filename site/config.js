import { join } from 'path'

export const rootDir = new URL('..', import.meta.url).pathname

export const docs = {
  srcPath: join(rootDir, 'docs'),
  outputPath: join(rootDir, 'site/src'),
}
