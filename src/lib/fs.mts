// @ts-check
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'constants'... Remove this comment to see the full error message
  constants,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
  promises: { access, readFile, rm, stat },
} = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'version'.
const { version } = require('process')

const del = require('del')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'parse'.
const { gte, parse } = require('semver')

const NODE_VERSION = parse(version)

/**
 * reads a file async and catches potential errors
 * @param {string} filePath
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFileAs... Remove this comment to see the full error message
const readFileAsyncCatchError = async (filePath: $TSFixMe) => {
  try {
    return { content: await readFile(filePath, 'utf-8') }
  } catch (error) {
    return { error }
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const fileExistsAsync = async (filePath: $TSFixMe) => {
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'rmdirRecur... Remove this comment to see the full error message
const rmdirRecursiveAsync = async (path: $TSFixMe) => {
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
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isType = async (filePath: $TSFixMe, type: $TSFixMe) => {
  try {
    const stats = await stat(filePath)
    return typeof stats[type] === 'function' ? stats[type]() : stats[type]
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if ((error_ as $TSFixMe).code === 'ENOENT') {
      return false
    }

    throw error_
  }
}

/**
 * Checks if the provided filePath is a file
 * @param {string} filePath
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isFileAsyn... Remove this comment to see the full error message
const isFileAsync = (filePath: $TSFixMe) => isType(filePath, 'isFile')

/**
 * Checks if the provided filePath is a directory
 * @param {string} filePath
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isDirector... Remove this comment to see the full error message
const isDirectoryAsync = (filePath: $TSFixMe) => isType(filePath, 'isDirectory')

module.exports = {
  fileExistsAsync,
  isDirectoryAsync,
  isFileAsync,
  readFileAsyncCatchError,
  rmdirRecursiveAsync,
}
