const test = require('ava')
const mock = require('mock-fs')

const { DependencyGraph } = require('./dependency-graph')
const { fileVisitor } = require('./file-visitor')

test.beforeEach(() => {
  mock({
    'src/nested/a.js': `const b = require('./b');const asdf = require('asdf'); const {c} = require('../c');`,
    'src/nested/b.js': '',
    'src/c/index.js': `const d = require('../d');`,
    'src/d.js': '',
    'tests/a.js': `const a = require('../src/nested/a');`,
    'tests/c.js': `const a = require('../src/c');const u = require('./utils');`,
    'tests/utils.js': '',
  })
})

test.afterEach(() => {
  mock.restore()
})

test.serial('should visit the files that are dependents from the provided main file', (t) => {
  const graph = new DependencyGraph()
  fileVisitor('tests/a.js', { graph, visitorPlugins: [] })

  mock.restore()
  t.snapshot(graph.visualize().to_dot())
})

test.serial('should merge the graph with files from a different entry point', (t) => {
  const graph = new DependencyGraph()
  fileVisitor('tests/a.js', { graph, visitorPlugins: [] })
  fileVisitor('tests/c.js', { graph, visitorPlugins: [] })

  mock.restore()
  t.snapshot(graph.visualize().to_dot())
})

test.serial('should build a list of affected files based on a file', (t) => {
  const graph = new DependencyGraph()
  fileVisitor('tests/a.js', { graph, visitorPlugins: [] })
  fileVisitor('tests/c.js', { graph, visitorPlugins: [] })

  t.deepEqual(
    [...graph.affected(['src/d.js'])],
    ['src/d.js', 'src/c/index.js', 'src/nested/a.js', 'tests/a.js', 'tests/c.js'],
  )

  t.deepEqual(
    [...graph.affected(['tests/utils.js'])],
    ['tests/utils.js', 'tests/c.js'],
  )
})
