const test = require('ava')
const { RuleTester } = require('eslint')

const rule = require('./index')

// eslint-disable-next-line no-magic-numbers
const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020 } })

test('should run the specified testRunner', (t) => {
  t.notThrows(() => {
    ruleTester.run('no-direct-chalk-import', rule, {
      valid: [
        {
          code: `let chalk = require('../utils')`,
        },
      ],
      invalid: [
        {
          code: `let chalk = require('chalk')`,
          // test the auto fix of the rule
          output: `let {chalk} = require('src/utils')`,
          errors: [
            {
              message:
                'Direct use of Chalk is forbidden. Please use the safe chalk import from `src/utils` that handles colors for json output.',
              type: 'CallExpression',
            },
          ],
        },
      ],
    })
  }, 'Rule scenario should not throw')
})
