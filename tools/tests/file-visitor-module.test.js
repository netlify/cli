const { join } = require('path')
const { format } = require('util')

const test = require('ava')
const mock = require('mock-fs')

const { normalize } = require('../../tests/utils/snapshots')
const { DependencyGraph, fileVisitor } = require('../project-graph')

const { esModuleMockedFileSystem } = require('./utils/file-systems')

test.before(() => {
  mock(esModuleMockedFileSystem)
})

test.after(() => {
  mock.restore()
})

test('should visit the files that are dependents from the provided main file based on imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  t.snapshot(normalize(graph.visualize().to_dot()))
})

test('should merge the graph with files from a different entry point based on imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })
  t.snapshot(normalize(graph.visualize().to_dot()))
})

test('should build a list of affected files based on a file with imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  t.snapshot(format(graph.affected([join('src/d.js')])).replace(/\\+/gm, '/'))
  t.snapshot(format(graph.affected([join('tests/utils.js')])).replace(/\\+/gm, '/'))
})
