// @ts-check
const { dirname, join, relative, sep } = require('path')

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    fixable: 'code',
    docs: {
      description: 'disallow direct import of `chalk` as it should be used with the safeChalk helper',
    },
    schema: [],
  },
  create: (context) => ({
    CallExpression: (node) => {
      if (
        node.callee.name === 'require' &&
        node.arguments &&
        node.arguments[0] &&
        node.arguments[0].value === 'chalk'
      ) {
        // if the path is empty it is on the same level and then use the direct file to import from
        let updatedPath = relative(dirname(context.getFilename()), join(context.getCwd(), 'src/utils')) || `.${sep}`
        if (!updatedPath.endsWith('utils')) {
          updatedPath = join(updatedPath, 'command-helpers')
        }

        // always use unix style seperators
        updatedPath = updatedPath.replace(/\\/gm, '/')
        if (!updatedPath.startsWith('.')) {
          updatedPath = `./${updatedPath}`
        }

        context.report({
          node,
          message:
            'Direct use of Chalk is forbidden. Please use the safe chalk import from `src/utils` that handles colors for json output.',
          fix: (fixer) => fixer.replaceTextRange(node.parent.range, `{chalk} = require('${updatedPath}')`),
        })
      }
    },
  }),
}
