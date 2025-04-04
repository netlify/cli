import { constants } from 'fs'
import { access, stat } from 'fs/promises'

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && Object.hasOwn(value, 'code')

export const fileExistsAsync = async (filePath: string) => {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * calls stat async with a function and catches potential errors
 */
const isType = async (filePath: string, type: 'isFile' | 'isDirectory') => {
  try {
    const stats = await stat(filePath)
    if (type === 'isFile') return stats.isFile()
    return stats.isDirectory()
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return false
    }

    throw error
  }
}

/**
 * Checks if the provided filePath is a file
 */
export const isFileAsync = async (filePath: string) => isType(filePath, 'isFile')

/**
 * Checks if the provided filePath is a directory
 */
export const isDirectoryAsync = async (filePath: string) => isType(filePath, 'isDirectory')
