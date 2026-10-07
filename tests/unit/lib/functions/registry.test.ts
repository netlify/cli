import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { watchDebounced } from '@netlify/dev-utils'
import { describe, expect, test, vi } from 'vitest'

import { FunctionsRegistry } from '../../../../src/lib/functions/registry.js'
import { createConfig } from '../../../integration/utils/config.js'

import { createFunctionsRegistry } from './fixtures.js'

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

vi.mock('@netlify/dev-utils', async () => {
  const helpers = await vi.importActual('@netlify/dev-utils')

  return {
    ...helpers,
    watchDebounced: vi.fn().mockImplementation(() => Promise.resolve({})),
  }
})

test('registry should only pass functions config to zip-it-and-ship-it', async (t) => {
  const projectRoot = '/projectRoot'
  const config = createConfig({
    functions: { '*': {} },
    plugins: [{ package: 'test' }],
  })
  const functionsRegistry = createFunctionsRegistry({ projectRoot, config })
  const prepareDirectoryStub = vi.spyOn(FunctionsRegistry, 'prepareDirectory').mockImplementation(async () => {})
  const setupDirectoryWatcherStub = vi
    .spyOn(functionsRegistry, 'setupDirectoryWatcher')
    .mockImplementation(async () => {})
  // To verify that only the functions config is passed to zip-it-ship-it
  const listFunctionsStub = vi.spyOn(functionsRegistry, 'listFunctions').mockImplementation(() => Promise.resolve([]))

  t.onTestFinished(() => {
    listFunctionsStub.mockRestore()
    setupDirectoryWatcherStub.mockRestore()
    prepareDirectoryStub.mockRestore()
  })

  await functionsRegistry.scan([projectRoot])

  expect(listFunctionsStub).toHaveBeenCalledOnce()
  expect(listFunctionsStub).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      config: config.functions,
    }),
  )
})

describe('the registry handles duplicate functions based on extension precedence', () => {
  test('where .js takes precedence over .go, and .go over .ts', async (t) => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'functions-extension-precedence'))
    const functionsDirectory = join(projectRoot, 'functions')
    await mkdir(functionsDirectory)

    for (const func of duplicateFunctions) {
      if (func.subDir) {
        const subDir = join(functionsDirectory, func.subDir)
        await mkdir(subDir)
      }
      const file = join(functionsDirectory, func.filename)
      await writeFile(file, func.content)
    }
    const functionsRegistry = createFunctionsRegistry({ projectRoot })
    const prepareDirectoryStub = vi.spyOn(FunctionsRegistry, 'prepareDirectory').mockImplementation(async () => {})
    const setupDirectoryWatcherStub = vi
      .spyOn(functionsRegistry, 'setupDirectoryWatcher')
      .mockImplementation(async () => {})

    t.onTestFinished(() => {
      setupDirectoryWatcherStub.mockRestore()
      prepareDirectoryStub.mockRestore()
    })

    await functionsRegistry.scan([functionsDirectory])
    expect(functionsRegistry.get('hello')).toHaveProperty('runtime.name', 'js')
    expect(functionsRegistry.get('hello2')).toHaveProperty('runtime.name', 'go')
  })
})

test('should add included_files to watcher', async () => {
  const registry = createFunctionsRegistry({ projectRoot: '/project-root' })
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

  // @ts-expect-error FIXME(ndhoule): We should not be touching this private member in tests
  await registry.buildFunctionAndWatchFiles(func)

  expect(watchDebounced).toHaveBeenCalledOnce()
  expect(watchDebounced).toHaveBeenCalledWith(['myfile', 'include/*'], expect.anything())
})
