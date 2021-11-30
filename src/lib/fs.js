const { F_OK } = require('fs')
const { access, readFile, stat } = require('fs/promises')

/**
 * reads a file async and catches potential errors
 * @param {string} filePath
 */
const readFileAsyncCatchError = async (filePath) => {
  try {
    return { content: await readFile(filePath, 'utf-8') }
  } catch (error) {
    return { error }
  }
}

const fileExistsAsync = async (filePath) => {
  try {
    await access(filePath, F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * calls stat async with a function and catches potential errors
 * @param {string} filePath
 * @param {keyof import('fs').StatsBase<number>} type For example `isDirectory` or `isFile`
 */
const isType = async (filePath, type) => {
  try {
    const stats = await stat(filePath)
    return stats[type]()
  } catch (error_) {
    if (error_.code === 'ENOENT') {
      return false
    }

    throw error_
  }
}

/**
 * Checks if the provided filePath is a file
 * @param {string} filePath
 */
const isFileAsync = (filePath) => isType(filePath, 'isFile')

/**
 * Checks if the provided filePath is a directory
 * @param {string} filePath
 */
const isDirectoryAsync = (filePath) => isType(filePath, 'isDirectory')

module.exports = {
  readFileAsyncCatchError,
  fileExistsAsync,
  isFileAsync,
  isDirectoryAsync,
}
