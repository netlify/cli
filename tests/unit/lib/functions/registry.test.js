import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, expect, test, vi } from 'vitest'

import { FunctionsRegistry } from '../../../../src/lib/functions/registry.js'
import { watchDebounced } from '../../../../src/utils/command-helpers.js'

const duplicateFunctions = [
  {
    filename: 'hello.js',
    content: `exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify({ message: 'Hello World from .js' }) })`,
  },
  {
    filename: 'hello.ts',
    content: `exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify({ message: 'Hello World from .ts' }) })`,
  },
  {
    filename: 'hello2.js',
    content: `exports.handler = async (event) => ({ statusCode: 200, body: JSON.stringify({ message: 'Hello World from .ts' }) })`,
  },
  {
    filename: 'hello2/main.go',
    subDir: 'hello2',
    content: `package main
    import (
      "fmt"
    )

    func main() {
      fmt.Println("Hello, world from a go function!")
    }
    `,
  },
]

vi.mock('../../../../src/utils/command-helpers.js', async () => {
  const helpers = await vi.importActual('../../../../src/utils/command-helpers.js')

  return {
    ...helpers,
    watchDebounced: vi.fn().mockImplementation(() => Promise.resolve({})),
  }
})

test('registry should only pass functions config to zip-it-and-ship-it', async () => {
  const functionsRegistry = new FunctionsRegistry({
    projectRoot: '/projectRoot',
    config: { functions: { '*': {} }, plugins: ['test'] },
  })
  const prepareDirectoryScanStub = vi.spyOn(FunctionsRegistry, 'prepareDirectoryScan').mockImplementation(() => {})
  const setupDirectoryWatcherStub = vi.spyOn(functionsRegistry, 'setupDirectoryWatcher').mockImplementation(() => {})
  // To verify that only the functions config is passed to zip-it-ship-it
  const listFunctionsStub = vi.spyOn(functionsRegistry, 'listFunctions').mockImplementation(() => Promise.resolve([]))

  await functionsRegistry.scan([functionsRegistry.projectRoot])

  expect(listFunctionsStub).toHaveBeenCalledOnce()
  expect(listFunctionsStub).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ config: functionsRegistry.config.functions }),
  )

  await listFunctionsStub.mockRestore()
  await setupDirectoryWatcherStub.mockRestore()
  await prepareDirectoryScanStub.mockRestore()
})

describe('the registry handles duplicate functions based on extension precedence', () => {
  test('where .js takes precedence over .go, and .go over .ts', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'functions-extension-precedence'))
    const functionsDirectory = join(projectRoot, 'functions')
    await mkdir(functionsDirectory)

    duplicateFunctions.forEach(async (func) => {
      if (func.subDir) {
        const subDir = join(functionsDirectory, func.subDir)
        await mkdir(subDir)
      }
      const file = join(functionsDirectory, func.filename)
      await writeFile(file, func.content)
    })
    const functionsRegistry = new FunctionsRegistry({
      projectRoot,
      config: {},
      timeouts: { syncFunctions: 1, backgroundFunctions: 1 },
      settings: { port: 8888 },
    })
    const prepareDirectoryScanStub = vi.spyOn(FunctionsRegistry, 'prepareDirectoryScan').mockImplementation(() => {})
    const setupDirectoryWatcherStub = vi.spyOn(functionsRegistry, 'setupDirectoryWatcher').mockImplementation(() => {})

    await functionsRegistry.scan([functionsDirectory])
    const { functions } = functionsRegistry

    expect(functions.get('hello').runtime.name).toBe('js')
    expect(functions.get('hello2').runtime.name).toBe('go')

    await setupDirectoryWatcherStub.mockRestore()
    await prepareDirectoryScanStub.mockRestore()
  })
})

test('should add included_files to watcher', async () => {
  const registry = new FunctionsRegistry({})
  const func = {
    name: '',
    config: { functions: { '*': { included_files: ['include/*', '!include/a.txt'] } } },
    build() {
      return { srcFilesDiff: { added: ['myfile'] }, includedFiles: ['include/*'] }
    },
    getRecommendedExtension() {},
    isTypeScript() {
      return false
    },
  }

  await registry.buildFunctionAndWatchFiles(func)

  expect(watchDebounced).toHaveBeenCalledOnce()
  expect(watchDebounced).toHaveBeenCalledWith(['myfile', 'include/*'], expect.anything())
})
