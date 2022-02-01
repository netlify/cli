const fs = require('fs')
const { join } = require('path')

const glob = require('fast-glob')
const { Volume } = require('memfs')

const { getAffectedFiles } = require('./affected-test')
const { simpleMockedFileSystem } = require('./tests/utils/file-systems')

jest.mock('fs', () => {
  const actualFS = jest.requireActual('fs')
  // eslint-disable-next-line node/global-require
  const unionFS = require('unionfs').default

  unionFS.reset = () => {
    // fss is unionfs' list of overlays
    unionFS.fss = [actualFS]
  }
  return unionFS.use(actualFS)
})

afterEach(() => {
  jest.clearAllMocks()
})

describe('simple file system', () => {
  /** @type {string[]} */
  let mockedTestFiles

  beforeEach(() => {
    const vol = Volume.fromJSON(simpleMockedFileSystem)

    // in this case we don't want to have the actual underlying fs so we clear them
    // we only have the fs from the volume now.
    fs.fss = []
    fs.use(vol)

    mockedTestFiles = Object.keys(simpleMockedFileSystem).filter((file) => file.match(/\.test\.m?js$/gm))
    jest.spyOn(glob, 'sync').mockReturnValue(mockedTestFiles)
  })

  test('should get all files marked as affected when the package.json is touched', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const affectedFiles = getAffectedFiles(['package.json'])

    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should get all files marked as affected when the npm-shrinkwrap.json is touched', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const affectedFiles = getAffectedFiles(['npm-shrinkwrap.json'])

    expect(consoleSpy).toHaveBeenNthCalledWith(1, 'All files are affected based on the changeset')
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should get all files marked as affected when a leaf is touched that both tests depend on', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const affectedFiles = getAffectedFiles([join('src/d.js')])

    expect(consoleSpy).not.toHaveBeenCalled()
    expect(affectedFiles).toMatchObject(mockedTestFiles)
  })

  test('should only one test affected if a file for it was called', () => {
    const affectedFiles = getAffectedFiles([join('src/nested/b.js')])

    expect(affectedFiles).toMatchObject([join('tests/a.test.js')])
  })

  test('should not have any file affected if a different file like a readme was affected', () => {
    const affectedFiles = getAffectedFiles(['README.md'])

    expect(affectedFiles).toHaveLength(0)
  })
})
