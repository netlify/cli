// @ts-check
const {
  constants,
  promises: { access, readFile, rm, stat },
} = require('fs')
const { version } = require('process')

const del = require('del')
const { gte, parse } = require('semver')

const NODE_VERSION = parse(version)

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
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Removes a directory recursively and async
 * @param {string} path
 * @returns {Promise<void>}
 */
const rmdirRecursiveAsync = async (path) => {
  if (gte(NODE_VERSION, '14.14.0')) {
    return await rm(path, { force: true, recursive: true })
  }
  await del(path, { force: true })
}

/**
 * calls stat async with a function and catches potential errors
 * @param {string} filePath
 * @param {keyof import('fs').StatsBase<number>} type For example `isDirectory` or `isFile`
 */
const isType = async (filePath, type) => {
  try {
    const stats = await stat(filePath)
    // @ts-ignore
    return typeof stats[type] === 'function' ? stats[type]() : stats[type]
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
  fileExistsAsync,
  isDirectoryAsync,
  isFileAsync,
  readFileAsyncCatchError,
  rmdirRecursiveAsync,
}
