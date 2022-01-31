import { join } from 'path'

import { jest } from '@jest/globals'
import glob from 'fast-glob'
import mock from 'mock-fs'

import { simpleMockedFileSystem } from './tests/utils/file-systems.mjs'

/**
 * Get a list of affected files for a mocked file system
 * @param {string[]} changedFiles The list of changed files
 * @param {Record<string, string>} fileSystem The mocked file system
 * @returns Returns a list of affected files
 */
const getAffectedFilesFromMock = async (changedFiles, fileSystem = simpleMockedFileSystem) => {
  const mockedTestFiles = Object.keys(fileSystem).filter((file) => file.match(/\.test\.m?js$/gm))
  const globSpy = jest.spyOn(glob, 'sync').mockReturnValue(mockedTestFiles)

  const { getAffectedFiles } = await import('./affected-test.mjs')
  mock(fileSystem)

  const affectedFiles = getAffectedFiles(changedFiles)

  mock.restore()
  globSpy.mockRestore()

  return { affectedFiles, mockedTestFiles }
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('simple file system', () => {
  test('should get all files marked as affected when the package.json is touched', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['package.json'])

    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should get all files marked as affected when the npm-shrinkwrap.json is touched', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['npm-shrinkwrap.json'])

    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should get all files marked as affected when a leaf is touched that both tests depend on', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock([join('src/d.js')])

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should only one test affected if a file for it was called', async () => {
    const { affectedFiles } = await getAffectedFilesFromMock([join('src/nested/b.js')])

    expect(affectedFiles).toMatchObject([join('tests/a.test.js')])
  })

  test('should not have any file affected if a different file like a readme was affected', async () => {
    const { affectedFiles } = await getAffectedFilesFromMock(['README.md'])

    expect(affectedFiles).toHaveLength(0)
  })
})
