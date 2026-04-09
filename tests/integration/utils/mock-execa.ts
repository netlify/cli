import { rm, writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'

import { temporaryFile } from '../../../src/utils/temporary-file.js'

// Saves to disk a JavaScript file with the contents provided and returns
// an environment variable that replaces the `execa` module implementation.
// A cleanup method is also returned, allowing the consumer to remove the
// mock file.
export const createMock = async (contents: string) => {
  const path = temporaryFile({ extension: 'js' })

  await writeFile(path, contents)

  const env = {
    // windows needs 'file://' paths
    NETLIFY_CLI_EXECA_PATH: pathToFileURL(path).href,
  }
  const cleanup = () =>
    rm(path, { force: true, recursive: true }).catch(() => {
      // no-op
    })

  return [env, cleanup] as const
}
