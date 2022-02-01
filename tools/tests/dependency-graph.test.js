const { DependencyGraph } = require('../project-graph')

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

test('should test if all parents are affected by changing a src file on the bottom', () => {
  expect(graph.affected(['src/d.js'])).toMatchSnapshot()
})

test('should test only the root leaf is affected if the root one is passed', () => {
  expect(graph.affected(['tests/a.js'])).toMatchSnapshot()
})

test('should test that nothing is affected if the passed file is not in the dependency graph', () => {
  expect([...graph.affected(['some-markdown.md'])]).toHaveLength(0)
})
