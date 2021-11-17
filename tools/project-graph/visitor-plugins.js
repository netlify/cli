// @ts-check
const { join } = require('path')

const ts = require('typescript')

const {
  oclif: { commands },
} = require('../../package.json')

const { resolveRelativeModule } = require('./file-visitor')

/** @type {import('./types').visitorPlugin[]} */
module.exports = [
  (node) => {
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
      return resolveRelativeModule(join(commands, node.arguments[1].elements[0].text))
    }
  },
]
