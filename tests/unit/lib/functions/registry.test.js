const { mkdir, mkdtemp, rm, writeFile } = require('fs').promises
const { tmpdir } = require('os')
const { join } = require('path')

const test = require('ava')
const sinon = require('sinon')

const { FunctionsRegistry } = require('../../../../src/lib/functions/registry')

test('registry should only pass functions config to zip-it-and-ship-it', async (t) => {
  const functionsRegistry = new FunctionsRegistry({
    projectRoot: '/projectRoot',
    config: { functions: { '*': {} }, plugins: ['test'] },
  })
  const prepareDirectoryScanStub = sinon.stub(FunctionsRegistry, 'prepareDirectoryScan')
  const setupDirectoryWatcherStub = sinon.stub(functionsRegistry, 'setupDirectoryWatcher')
   // To verify that only the functions config is passed to zip-it-ship-it
  const listFunctionsStub = sinon.stub(functionsRegistry, 'listFunctions')
  listFunctionsStub.returns(Promise.resolved([]))
  
  await functionsRegistry.scan([functionsDirectory])

  const spyCall = listFunctionsStub.getCall(0)

  t.is(spyCall.lastArg.config, functionsRegistry.config.functions)
  
  t.teardown(async () => {
    listFunctionsStub.restore()
    setupDirectoryWatcherStub.restore()
    prepareDirectoryScanStub.restore()
  })
})
