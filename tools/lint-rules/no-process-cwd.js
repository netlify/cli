/**
 * @type {import('eslint').Rule.RuleModule}
 */
// eslint-disable-next-line no-undef
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow usage of `process.cwd` or `import of { cwd } from "process"`. Instead use the `command.workingDir`',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    rulePath: 'tools/lint-rules/eslint-plugin-no-process-cwd.js',
  },
  /**
   * @param {import('eslint').Rule.RuleContext} context
   */
  create: function (context) {
    return {
      ImportDeclaration: function (node) {
        if (node.source.value === 'process') {
          const { specifiers } = node
          for (const specifier of specifiers) {
            if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'cwd') {
              context.report({
                node: specifier,
                message:
                  'Importing `cwd` from process is not allowed. Instead of using `process.cwd` use the `command.workingDir` property that is monorepo aware.',
              })
            }
          }
        }
      },
      MemberExpression: function (node) {
        if (node.object.name === 'process' && node.property.name === 'cwd') {
          context.report({
            node,
            message:
              'Usage of `process.cwd` is not allowed. Instead use the `command.workingDir` property that is monorepo aware.',
          })
        }
      },
    }
  },
}
