// @ts-check
const { writeFileSync } = require('fs')
const { join } = require('path')

const ts = require('typescript')

const {
  oclif: { commands },
} = require('../../package.json')

const { parseDependencies, resolveRelativeModule } = require('./parse-dependencies')
const visualizeGraph = require('./visualize-graph')

/** @type {import('./types').visitorPlugin[]} */
const visitorPlugins = [
  (node, state) => {
    // check if `await execa(cliPath, ['build', ...flags], {` is used for the command
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'execa' &&
      ts.isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === 'cliPath' &&
      ts.isArrayLiteralExpression(node.arguments[1]) &&
      ts.isStringLiteral(node.arguments[1].elements[0])
    ) {
      const fileName = resolveRelativeModule(join(commands, node.arguments[1].elements[0].text))
      state.dependencies.push({
        fileName,
        type: 'indirect',
        identifiers: [],
        dependencies: parseDependencies(fileName),
      })
    }
  },
]

const entryFile = 'tests/serving-functions.test.js'
const dependencies = parseDependencies(entryFile, visitorPlugins)

const dotGraph = visualizeGraph(entryFile, dependencies)
// can be simply converted to png by running: `$ cat dep-graph.dot | dot -Tpng >| output.png`
writeFileSync('dep-graph.dot', dotGraph)
