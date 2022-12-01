const test = require('ava')
const sinon = require('sinon')

const { rewiremock } = require('../../../integration/utils/rewiremock.cjs')

const watchDebouncedSpy = sinon.stub()
// eslint-disable-next-line n/global-require
const { FunctionsRegistry } = rewiremock.proxy(() => require('../../../../src/lib/functions/registry.cjs'), {
  '../../../../src/utils/index.cjs': {
    watchDebounced: watchDebouncedSpy,
  },
})
watchDebouncedSpy.resolves({})

test('registry should only pass functions config to zip-it-and-ship-it', async (t) => {
  const functionsRegistry = new FunctionsRegistry({
    projectRoot: '/projectRoot',
    config: { functions: { '*': {} }, plugins: ['test'] },
  })
  const prepareDirectoryScanStub = sinon.stub(FunctionsRegistry, 'prepareDirectoryScan')
  const setupDirectoryWatcherStub = sinon.stub(functionsRegistry, 'setupDirectoryWatcher')
  // To verify that only the functions config is passed to zip-it-ship-it
  const listFunctionsStub = sinon.stub(functionsRegistry, 'listFunctions')
  listFunctionsStub.returns(Promise.resolve([]))

  await functionsRegistry.scan([functionsRegistry.projectRoot])

  const spyCall = listFunctionsStub.getCall(0)

  t.is(spyCall.lastArg.config, functionsRegistry.config.functions)

  t.teardown(async () => {
    await listFunctionsStub.restore()
    await setupDirectoryWatcherStub.restore()
    await prepareDirectoryScanStub.restore()
  })
})

test('should add included_files to watcher', async (t) => {
  const registry = new FunctionsRegistry({})
  const func = {
    name: '',
    config: { functions: { '*': { included_files: ['include/*', '!include/a.txt'] } } },
    build() {
      return { srcFilesDiff: { added: ['myfile'] }, includedFiles: ['include/*'] }
    },
  }

  await registry.buildFunctionAndWatchFiles(func)

  t.is(watchDebouncedSpy.callCount, 1)
  t.deepEqual(watchDebouncedSpy.args[0][0], ['myfile', 'include/*'])
})
