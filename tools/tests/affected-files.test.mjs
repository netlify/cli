import { join } from 'path'

import { afterEach, beforeEach, test, vi } from 'vitest'
import glob from 'fast-glob'
import mock from 'mock-fs'
import { stub } from 'sinon'
import { getAffectedFiles } from '../affected-test.mjs'

import { simpleMockedFileSystem } from './utils/file-systems.mjs'

/**
 * Get a list of affected files for a mocked file system
 * @param {string[]} changedFiles The list of changed files
 * @param {Record<string, string>} fileSystem The mocked file system
 * @returns Returns a list of affected files
 */
const getAffectedFilesFromMock = async (changedFiles, fileSystem = simpleMockedFileSystem) => {
  const mockedTestFiles = Object.keys(fileSystem).filter((file) => file.match(/\.test\.m?js$/gm))
  const globStub = stub(glob, 'sync').returns(mockedTestFiles)

  mock(fileSystem)

  const affectedFiles = getAffectedFiles(changedFiles)

  mock.restore()
  globStub.restore()

  return { affectedFiles, mockedTestFiles }
}

let consoleStub

beforeEach(() => {
  consoleStub = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleStub.mockRestore()
})

test('should get all files marked as affected when the package.json is touched', async (t) => {
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['package.json'])

  t.expect(consoleStub).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
  t.expect(affectedFiles).toEqual(mockedTestFiles)
})

test('should get all files marked as affected when the package-lock.json is touched', async (t) => {
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['package-lock.json'])

  t.expect(consoleStub).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
  t.expect(affectedFiles).toEqual(mockedTestFiles)
})

test('should get all files marked as affected when a leaf is touched that both tests depend on', async (t) => {
  const consoleStub = stub(console, 'log').callsFake(() => {})
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock([join('src/d.js')])

  t.expect(consoleStub.notCalled).toBeTruthy()
  t.expect(affectedFiles).toEqual(mockedTestFiles)
  consoleStub.restore()
})

test('should only one test affected if a file for it was called', async (t) => {
  const { affectedFiles } = await getAffectedFilesFromMock([join('src/nested/b.js')])

  t.expect(affectedFiles).toEqual([join('tests/a.test.js')])
})

test('should not have any file affected if a different file like a readme was affected', async (t) => {
  const { affectedFiles } = await getAffectedFilesFromMock(['README.md'])

  t.expect(affectedFiles.length).toBe(0)
})
