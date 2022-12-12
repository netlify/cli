const { writeFile } = require('fs').promises
const { pathToFileURL } = require('url')

const tempy = require('tempy')

const { rmdirRecursiveAsync } = require('../../../src/lib/fs.cjs')

// Saves to disk a JavaScript file with the contents provided and returns
// an environment variable that replaces the `execa` module implementation.
// A cleanup method is also returned, allowing the consumer to remove the
// mock file.
const createMock = async (contents) => {
  const path = tempy.file({ extension: 'js' })

  await writeFile(path, contents)

  const env = {
    // windows needs 'file://' paths
    NETLIFY_CLI_EXECA_PATH: pathToFileURL(path).href,
  }
  const cleanup = () =>
    // eslint-disable-next-line promise/prefer-await-to-then
    rmdirRecursiveAsync(path).catch(() => {
      // no-op
    })

  return [env, cleanup]
}

module.exports = { createMock }
