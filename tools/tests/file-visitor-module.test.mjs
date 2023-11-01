import { join } from 'path'
import { format } from 'util'

import test from 'ava'
import mock, { restore } from 'mock-fs'

import snapshots from '../../tests/integration/utils/snapshots.mjs'
import { DependencyGraph, fileVisitor } from '../project-graph/index.mjs'

import { esModuleMockedFileSystem } from './utils/file-systems.mjs'

test.before(() => {
  mock(esModuleMockedFileSystem)
})

test.after(() => {
  restore()
})

test('should visit the files that are dependents from the provided main file based on imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  t.is(
    snapshots.normalize(graph.visualize().to_dot()),
    `digraph G {
  "src/nested/b.js";
  "src/nested/a.js";
  "src/c/index.js";
  "src/d.js";
  "tests/a.test.js";
  "src/nested/a.js" -> "src/nested/b.js";
  "src/nested/a.js" -> "src/c/index.js";
  "src/c/index.js" -> "src/d.js";
  "tests/a.test.js" -> "src/nested/a.js";
}`,
  )
})

test('should merge the graph with files from a different entry point based on imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })
  t.is(
    snapshots.normalize(graph.visualize().to_dot()),
    `digraph G {
  "src/nested/b.js";
  "src/nested/a.js";
  "src/c/index.js";
  "src/d.js";
  "tests/a.test.js";
  "tests/c.test.js";
  "tests/utils.js";
  "src/nested/a.js" -> "src/nested/b.js";
  "src/nested/a.js" -> "src/c/index.js";
  "src/c/index.js" -> "src/d.js";
  "tests/a.test.js" -> "src/nested/a.js";
  "tests/c.test.js" -> "src/c/index.js";
  "tests/c.test.js" -> "tests/utils.js";
}`,
  )
})

test('should build a list of affected files based on a file with imports', (t) => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  t.is(
    format([...graph.affected([join('src/d.js')])]).replace(/\\+/gm, '/'),
    `[
  'src/d.js',
  'src/c/index.js',
  'src/nested/a.js',
  'tests/a.test.js',
  'tests/c.test.js'
]`,
  )
  t.is(
    format([...graph.affected([join('tests/utils.js')])]).replace(/\\+/gm, '/'),
    "[ 'tests/utils.js', 'tests/c.test.js' ]",
  )
})
