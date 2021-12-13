const { join } = require('path')

const test = require('ava')
const glob = require('fast-glob')
const mock = require('mock-fs')
const sinon = require('sinon')

const { simpleMockedFileSystem } = require('./utils/file-systems')

const mockedTestFiles = Object.keys(simpleMockedFileSystem).filter((file) => file.endsWith('.test.js'))
sinon.stub(glob, 'sync').returns(mockedTestFiles)

// eslint-disable-next-line import/order
const { getAffectedFiles } = require('../affected-test')

test.beforeEach(() => {
  mock(simpleMockedFileSystem)
})

test.afterEach(() => {
  mock.restore()
  sinon.restore()
})

test('should get all files marked as affected when the package.json is touched', (t) => {
  const consoleStub = sinon.stub(console, 'log').callsFake(() => {})
  const affectedFiles = getAffectedFiles(['package.json'])

  t.truthy(consoleStub.firstCall.calledWith('All files are affected based on the changeset'))
  t.deepEqual(affectedFiles, mockedTestFiles)
  consoleStub.restore()
})

test('should get all files marked as affected when the npm-shrinkwrap.json is touched', (t) => {
  const consoleStub = sinon.stub(console, 'log').callsFake(() => {})
  const affectedFiles = getAffectedFiles(['npm-shrinkwrap.json'])

  t.truthy(consoleStub.firstCall.calledWith('All files are affected based on the changeset'))
  t.deepEqual(affectedFiles, mockedTestFiles)
  consoleStub.restore()
})

test('should get all files marked as affected when a leaf is touched that both tests depend on', (t) => {
  const consoleStub = sinon.stub(console, 'log').callsFake(() => {})
  const affectedFiles = getAffectedFiles([join('src/d.js')])

  t.truthy(consoleStub.notCalled)
  t.deepEqual(affectedFiles, mockedTestFiles)
  consoleStub.restore()
})

test('should only one test affected if a file for it was called', (t) => {
  const affectedFiles = getAffectedFiles([join('src/nested/b.js')])
  t.deepEqual(affectedFiles, [join('tests/a.test.js')])
})

test('should not have any file affected if a different file like a readme was affected', (t) => {
  const affectedFiles = getAffectedFiles(['README.md'])
  t.is(affectedFiles.length, 0)
})
