const tempy = require('tempy')

const { safelyRmdirRecursiveAsync, writeFileAsync } = require('../../src/lib/fs')

// Saves to disk a JavaScript file with the contents provided and returns
// an environment variable that replaces the `execa` module implementation.
// A cleanup method is also returned, allowing the consumer to remove the
// mock file.
const createMock = async (contents) => {
  const path = tempy.file({ extension: 'js' })

  await writeFileAsync(path, contents)

  const env = {
    NETLIFY_CLI_EXECA_PATH: path,
  }
  const cleanup = () => safelyRmdirRecursiveAsync(path)

  return [env, cleanup]
}

module.exports = { createMock }
