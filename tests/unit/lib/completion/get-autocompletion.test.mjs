// @ts-check
import test from 'ava'

import getAutocompletion from '../../../../src/lib/completion/get-autocompletion.mjs'

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
