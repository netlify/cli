import { test, beforeEach } from 'vitest'

import { DependencyGraph } from '../project-graph/index.mjs'

/** @type {DependencyGraph} */
let graph

beforeEach(() => {
  graph = new DependencyGraph()
  graph.addDependency('tests/a.js', 'src/nested/a.js')
  graph.addDependency('tests/c.js', 'src/c/index.js')
  graph.addDependency('tests/c.js', 'tests/utils.js')
  graph.addDependency('src/nested/a.js', 'src/nested/b.js')
  graph.addDependency('src/nested/a.js', 'src/c/index.js')
  graph.addDependency('src/c/index.js', 'src/d.js')
})

test('should test if all parents are affected by changing a src file on the bottom', (t) => {
  t.expect(graph.affected(['src/d.js'])).toStrictEqual(
    new Set(['src/d.js', 'src/c/index.js', 'src/nested/a.js', 'tests/a.js', 'tests/c.js']),
  )
})

test('should test only the root leaf is affected if the root one is passed', (t) => {
  t.expect([...graph.affected(['tests/a.js'])]).toStrictEqual(['tests/a.js'])
})

test('should test that nothing is affected if the passed file is not in the dependency graph', (t) => {
  t.expect(graph.affected(['some-markdown.md']).size).toEqual(0)
})
