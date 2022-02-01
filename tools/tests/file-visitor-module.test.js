const fs = require('fs')
const { join } = require('path')
const { format } = require('util')

const { Volume } = require('memfs')

const { normalize } = require('../../tests/utils/snapshots')
const { DependencyGraph, fileVisitor } = require('../project-graph')

const { esModuleMockedFileSystem } = require('./utils/file-systems')

jest.mock('fs', () => {
  const actualFS = jest.requireActual('fs')
  // eslint-disable-next-line node/global-require
  const unionFS = require('unionfs').default

  unionFS.reset = () => {
    // fss is unionfs' list of overlays
    unionFS.fss = [actualFS]
  }
  return unionFS.use(actualFS)
})

beforeEach(() => {
  const vol = Volume.fromJSON(esModuleMockedFileSystem)
  // in this case we don't want to have the actual underlying fs so we clear them
  // we only have the fs from the volume now.
  fs.fss = []
  fs.use(vol)
})

test('should visit the files that are dependents from the provided main file based on imports', () => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  expect(normalize(graph.visualize().to_dot())).toMatchSnapshot()
})

test('should merge the graph with files from a different entry point based on imports', () => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  expect(normalize(graph.visualize().to_dot())).toMatchSnapshot()
})

test('should build a list of affected files based on a file with imports', () => {
  const graph = new DependencyGraph()
  fileVisitor(join('tests/a.test.js'), { graph, visitorPlugins: [] })
  fileVisitor(join('tests/c.test.js'), { graph, visitorPlugins: [] })

  expect(format([...graph.affected([join('src/d.js')])]).replace(/\\+/gm, '/')).toMatchSnapshot()
  expect(format([...graph.affected([join('tests/utils.js')])]).replace(/\\+/gm, '/')).toMatchSnapshot()
})
