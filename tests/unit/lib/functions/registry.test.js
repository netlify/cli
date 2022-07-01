// Node 12 requires rmdir, when upping to v14+ use rm from 'fs/promises'
const { mkdir, mkdtemp, rm, writeFile } = require('fs').promises
const { tmpdir } = require('os')
const { join } = require('path')

const test = require('ava')
const sinon = require('sinon')

const { FunctionsRegistry } = require('../../../../src/lib/functions/registry')

let projectRoot
let functionsDirectory

const createFunction = async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'functions-project-root'))
  functionsDirectory = join(projectRoot, 'functions')
  await mkdir(functionsDirectory)
  const mainFile = join(functionsDirectory, 'horse.js')

  await writeFile(mainFile, `exports.handler = async (event) => ({ statusCode: 200, body: event.rawUrl })`)
}

test.beforeEach(async () => {
  await createFunction()
})

test.afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true })
})

test('registry should only pass functions config to zip-it-and-ship-it', async (t) => {
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
})
