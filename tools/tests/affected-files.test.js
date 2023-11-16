import { join } from 'path'

import { test } from 'vitest'
import glob from 'fast-glob'
import mock from 'mock-fs'
import { stub, createSandbox } from 'sinon'

import { simpleMockedFileSystem } from './utils/file-systems.js'
import { getAffectedFiles } from '../affected-test.js'

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

test.beforeEach((t) => {
  t.context.sandbox = createSandbox()
})

test.afterEach((t) => {
  t.context.sandbox.restore()
})

test('should get all files marked as affected when the package.json is touched', async (t) => {
  const consoleStub = t.context.sandbox.stub(console, 'log').callsFake(() => {})
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['package.json'])

  t.truthy(consoleStub.firstCall.calledWith('All files are affected based on the changeset'))
  t.deepEqual(affectedFiles, mockedTestFiles)
})

test.serial('should get all files marked as affected when the package-lock.json is touched', async (t) => {
  const consoleStub = t.context.sandbox.stub(console, 'log').callsFake(() => {})
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock(['package-lock.json'])

  t.truthy(consoleStub.firstCall.calledWith('All files are affected based on the changeset'))
  t.deepEqual(affectedFiles, mockedTestFiles)
})

test.serial('should get all files marked as affected when a leaf is touched that both tests depend on', async (t) => {
  const consoleStub = stub(console, 'log').callsFake(() => {})
  const { affectedFiles, mockedTestFiles } = await getAffectedFilesFromMock([join('src/d.js')])

  t.truthy(consoleStub.notCalled)
  t.deepEqual(affectedFiles, mockedTestFiles)
  consoleStub.restore()
})

test.serial('should only one test affected if a file for it was called', async (t) => {
  const { affectedFiles } = await getAffectedFilesFromMock([join('src/nested/b.js')])

  t.deepEqual(affectedFiles, [join('tests/a.test.js')])
})

test.serial('should not have any file affected if a different file like a readme was affected', async (t) => {
  const { affectedFiles } = await getAffectedFilesFromMock(['README.md'])

  t.is(affectedFiles.length, 0)
})
