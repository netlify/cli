// @ts-check
import { constants } from 'fs'
import { access, stat } from 'fs/promises'

export const fileExistsAsync = async (filePath) => {
  try {
    await access(filePath, constants.F_OK)
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
export const isFileAsync = (filePath) => isType(filePath, 'isFile')

/**
 * Checks if the provided filePath is a directory
 * @param {string} filePath
 */
export const isDirectoryAsync = (filePath) => isType(filePath, 'isDirectory')
