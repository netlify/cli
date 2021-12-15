// @ts-check
import { join } from 'path'

import { isCallExpression, isIdentifier, isArrayLiteralExpression, isStringLiteral } from 'typescript'

import { resolveRelativeModule } from './file-visitor.js'

const COMMANDS = 'src/commands'

/** @type {import('./types').visitorPlugin[]} */
export const visitorPlugins = [
  (node) => {
    // check if `await execa(cliPath, ['build', ...flags], {` is used for the command
    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === 'execa' &&
      isIdentifier(node.arguments[0]) &&
      node.arguments[0].text === 'cliPath' &&
      isArrayLiteralExpression(node.arguments[1]) &&
      isStringLiteral(node.arguments[1].elements[0])
    ) {
      return resolveRelativeModule(join(COMMANDS, node.arguments[1].elements[0].text))
    }
  },
  (node) => {
    // check if `await callCli(['api', 'listSites'], getCLIOptions(apiUrl))`
    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === 'callCli' &&
      isArrayLiteralExpression(node.arguments[0]) &&
      isStringLiteral(node.arguments[0].elements[0])
    ) {
      const [argument] = node.arguments[0].elements[0].text.split(':')

      if (!argument.startsWith('-')) {
        return resolveRelativeModule(join(COMMANDS, node.arguments[0].elements[0].text))
      }
    }
  },
]
