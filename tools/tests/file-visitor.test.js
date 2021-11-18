const { join } = require('path')
const { format } = require('util')

const test = require('ava')
const mock = require('mock-fs')

const { normalize } = require('../../tests/utils/snapshots')
const { DependencyGraph, fileVisitor } = require('../project-graph')

const { simpleMockedFileSystem } = require('./utils/file-systems')

test.beforeEach(() => {
  mock(simpleMockedFileSystem)
})

test.afterEach(() => {
  mock.restore()
})

test.serial('should visit the files that are dependents from the provided main file', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })

  mock.restore()
  t.snapshot(normalize(graph.visualize().to_dot()))
})

test.serial('should merge the graph with files from a different entry point', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  mock.restore()
  t.snapshot(normalize(graph.visualize().to_dot()))
})

test.serial('should build a list of affected files based on a file', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  t.snapshot(format(graph.affected([join('src/d.js')])).replace(/\\+/gm, '/'))
  t.snapshot(format(graph.affected([join('tests/utils.js')])).replace(/\\+/gm, '/'))
})
