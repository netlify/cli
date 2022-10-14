// @ts-check
const fs = require('fs')

const test = require('ava')
const { Argument } = require('commander')
const sinon = require('sinon')

const { getAutocompletion } = require('../../../../src/lib/completion/script.cjs')

const createTestCommand = async () => {
  const { default: BaseCommand } = await import('../../../../src/commands/base-command.mjs')
  const program = new BaseCommand('chef')

  program
    .command('bake')
    .alias('cook')
    .description('Cooks something')
    .addExamples(['chef cook pizza'])
    .argument('<type>', 'the type to cook')
    .option('-f, --fast', 'cook it fast')

  program.command('bake:pizza').description('bakes a pizza').option('--type <type>', 'Type of pizza', 'neapolitan')

  program
    .command('taste')
    .description('tastes something')
    .addArgument(new Argument('<name>', 'what to taste').choices(['pizza', 'sauce']))

  return program
}

test.afterEach(() => {
  sinon.restore()
})

test('should generate a completion file', async (t) => {
  const stub = sinon.stub(fs, 'writeFileSync').callsFake(() => {})
  // eslint-disable-next-line n/global-require
  const { createAutocompletion } = require('../../../../src/lib/completion/generate-autocompletion.cjs')
  const program = await createTestCommand()

  createAutocompletion(program)

  // @ts-ignore
  t.true(stub.getCall(0).args[0].endsWith('autocompletion.json'), 'should write a autocompletion file')

  // @ts-ignore
  t.snapshot(JSON.parse(stub.getCall(0).args[1]))

  stub.restore()
})

const cookingFixtures = {
  cook: {
    name: 'cook',
    description: 'cooking',
    options: [],
  },
  bake: {
    name: 'bake',
    description: 'baking',
    options: [
      { name: '--heat', description: 'heated' },
      { name: '--duration', description: 'duration' },
      { name: '--heat-type', description: 'type' },
    ],
  },
}

test('should not autocomplete anything when completion is turned off', (t) => {
  // @ts-ignore
  t.is(getAutocompletion({}, cookingFixtures), undefined)
  // @ts-ignore
  t.is(getAutocompletion({ complete: false }, cookingFixtures), undefined)
  // @ts-ignore
  t.is(getAutocompletion({ complete: false, words: 2 }, cookingFixtures), undefined)
})

test('should get the correct autocompletion for the base command', (t) => {
  // @ts-ignore
  const completion = getAutocompletion({ complete: true, words: 1, lastPartial: '' }, cookingFixtures)
  t.deepEqual(completion, [
    { name: 'cook', description: 'cooking' },
    { name: 'bake', description: 'baking' },
  ])
})

test('should get the correct autocompletion for the base command if there is already a word', (t) => {
  // @ts-ignore
  const completion = getAutocompletion({ complete: true, words: 1, lastPartial: 'ba' }, cookingFixtures)
  t.deepEqual(completion, [{ name: 'bake', description: 'baking' }])
})

test('should get no flags if the command has no flags', (t) => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 2, lastPartial: '', line: 'netlify cook' },
    cookingFixtures,
  )
  t.deepEqual(completion, [])
})

test('should get the correct flags for the command', (t) => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 2, lastPartial: '', line: 'netlify bake' },
    cookingFixtures,
  )
  t.deepEqual(completion, cookingFixtures.bake.options)
})

test('should get the correct left over flags for the command', (t) => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 3, lastPartial: '', line: 'netlify bake --heat' },
    cookingFixtures,
  )
  t.deepEqual(completion, [
    { name: '--duration', description: 'duration' },
    { name: '--heat-type', description: 'type' },
  ])
})

test('should get no results if the command has no left over flags anymore', (t) => {
  const completion = getAutocompletion(
    // @ts-ignore
    // eslint-disable-next-line no-magic-numbers
    { complete: true, words: 4, lastPartial: '', line: 'netlify bake --heat --heat-type --duration' },
    cookingFixtures,
  )
  t.deepEqual(completion, [])
})

test('should autocomplete flags', (t) => {
  const completion = getAutocompletion(
    // @ts-ignore
    // eslint-disable-next-line no-magic-numbers
    { complete: true, words: 4, lastPartial: '--hea', line: 'netlify bake --heat --hea' },
    cookingFixtures,
  )
  t.deepEqual(completion, [{ name: '--heat-type', description: 'type' }])
})
