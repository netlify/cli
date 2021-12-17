import { join } from 'path'

const rootDir = new URL('..', import.meta.url).pathname

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  rootDir,
  docs: {
    srcPath: join(rootDir, 'docs'),
    outputPath: join(rootDir, 'site/src'),
  },
}
