const { readFile } = require('fs/promises')

/**
 * reads a file async and catches potential errors
 * @param {string} filepath
 */
const readFileAsyncCatchError = async (filepath) => {
  try {
    return { content: await readFile(filepath, 'utf-8') }
  } catch (error) {
    return { error }
  }
}

module.exports = {
  readFileAsyncCatchError,
}
