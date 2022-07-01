const { mkdir, mkdtemp, rm, writeFile } = require('fs').promises
const { tmpdir } = require('os')
const { join } = require('path')

const test = require('ava')
const sinon = require('sinon')

const { FunctionsRegistry } = require('../../../../src/lib/functions/registry')

test('registry should only pass functions config to zip-it-and-ship-it', async (t) => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'functions-project-root'))
  const functionsDirectory = join(projectRoot, 'functions')
  await mkdir(functionsDirectory)
  const mainFile = join(functionsDirectory, 'horse.js')

  await writeFile(mainFile, `exports.handler = async (event) => ({ statusCode: 200, body: event.rawUrl })`)
  const functionsRegistry = new FunctionsRegistry({
    projectRoot,
    config: { functions: { '*': {} }, plugins: ['test'] },
    timeouts: { syncFunctions: 1, backgroundFunctions: 1 },
    // eslint-disable-next-line no-magic-numbers
    settings: { port: 8888 },
  })
  // To verify that only the functions config is passed to zip-it-ship-it
  sinon.spy(functionsRegistry, 'listFunctions')

  await functionsRegistry.scan([functionsDirectory])

  const spyCall = functionsRegistry.listFunctions.getCall(0)

  t.is(spyCall.lastArg.config, functionsRegistry.config.functions)
  t.teardown(async () => {
    await rm(projectRoot, { recursive: true, force: true })
  })
})
