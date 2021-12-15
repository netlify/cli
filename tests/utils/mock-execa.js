import { promises } from 'fs'

import tempy from 'tempy'

import { rmdirRecursiveAsync } from '../../src/lib/fs.js'

const { writeFile } = promises

// Saves to disk a JavaScript file with the contents provided and returns
// an environment variable that replaces the `execa` module implementation.
// A cleanup method is also returned, allowing the consumer to remove the
// mock file.
export const createMock = async (contents) => {
  const path = tempy.file({ extension: 'js' })

  await writeFile(path, contents)

  const env = {
    NETLIFY_CLI_EXECA_PATH: path,
  }
  const cleanup = () =>
    // eslint-disable-next-line promise/prefer-await-to-then
    rmdirRecursiveAsync(path).catch(() => {
      // no-op
    })

  return [env, cleanup]
}
