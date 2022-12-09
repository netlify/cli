import { expect, test, vi } from 'vitest'

import { FunctionsRegistry } from '../../../../src/lib/functions/registry.mjs'
import { watchDebounced } from '../../../../src/utils/command-helpers.mjs'

vi.mock('../../../../src/utils/command-helpers.mjs', async () => {
  const helpers = await vi.importActual('../../../../src/utils/command-helpers.mjs')

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

test('should add included_files to watcher', async () => {
  const registry = new FunctionsRegistry({})
  const func = {
    name: '',
    config: { functions: { '*': { included_files: ['include/*', '!include/a.txt'] } } },
    build() {
      return { srcFilesDiff: { added: ['myfile'] }, includedFiles: ['include/*'] }
    },
  }

  await registry.buildFunctionAndWatchFiles(func)

  expect(watchDebounced).toHaveBeenCalledOnce()
  expect(watchDebounced).toHaveBeenCalledWith(['myfile', 'include/*'], expect.anything())
})
