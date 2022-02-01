// @ts-check
const fs = require('fs')

const { Argument } = require('commander')

const { BaseCommand } = require('../../../commands/base-command')
const { getAutocompletion } = require('../script')

const createTestCommand = () => {
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

afterEach(() => {
  jest.resetAllMocks()
})

test('should generate a completion file', () => {
  const writeFileSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
  const program = createTestCommand()
  // eslint-disable-next-line node/global-require
  const { createAutocompletion } = require('../generate-autocompletion')
  createAutocompletion(program)

  // @ts-ignore
  expect(writeFileSpy).toHaveBeenCalledTimes(1)
  expect(JSON.parse(writeFileSpy.mock.calls[0][1])).toMatchSnapshot()
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

test('should not autocomplete anything when completion is turned off', () => {
  // @ts-ignore
  expect(getAutocompletion({}, cookingFixtures)).toBe(undefined)
  // @ts-ignore
  expect(getAutocompletion({ complete: false }, cookingFixtures)).toBe(undefined)
  // @ts-ignore
  expect(getAutocompletion({ complete: false, words: 2 }, cookingFixtures)).toBe(undefined)
})

test('should get the correct autocompletion for the base command', () => {
  // @ts-ignore
  const completion = getAutocompletion({ complete: true, words: 1, lastPartial: '' }, cookingFixtures)
  expect(completion).toEqual([
    { name: 'cook', description: 'cooking' },
    { name: 'bake', description: 'baking' },
  ])
})

test('should get the correct autocompletion for the base command if there is already a word', () => {
  // @ts-ignore
  const completion = getAutocompletion({ complete: true, words: 1, lastPartial: 'ba' }, cookingFixtures)
  expect(completion).toEqual([{ name: 'bake', description: 'baking' }])
})

test('should get no flags if the command has no flags', () => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 2, lastPartial: '', line: 'netlify cook' },
    cookingFixtures,
  )
  expect(completion).toEqual([])
})

test('should get the correct flags for the command', () => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 2, lastPartial: '', line: 'netlify bake' },
    cookingFixtures,
  )
  expect(completion).toEqual(cookingFixtures.bake.options)
})

test('should get the correct left over flags for the command', () => {
  const completion = getAutocompletion(
    // @ts-ignore
    { complete: true, words: 3, lastPartial: '', line: 'netlify bake --heat' },
    cookingFixtures,
  )
  expect(completion).toEqual([
    { name: '--duration', description: 'duration' },
    { name: '--heat-type', description: 'type' },
  ])
})

test('should get no results if the command has no left over flags anymore', () => {
  const completion = getAutocompletion(
    // @ts-ignore
    // eslint-disable-next-line no-magic-numbers
    { complete: true, words: 4, lastPartial: '', line: 'netlify bake --heat --heat-type --duration' },
    cookingFixtures,
  )
  expect(completion).toEqual([])
})

test('should autocomplete flags', () => {
  const completion = getAutocompletion(
    // @ts-ignore
    // eslint-disable-next-line no-magic-numbers
    { complete: true, words: 4, lastPartial: '--hea', line: 'netlify bake --heat --hea' },
    cookingFixtures,
  )
  expect(completion).toEqual([{ name: '--heat-type', description: 'type' }])
})
