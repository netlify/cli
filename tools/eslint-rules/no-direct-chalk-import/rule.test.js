import test from 'ava'
import { RuleTester } from 'eslint'

import rule from './index.cjs'

// eslint-disable-next-line no-magic-numbers
const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020 } })

test('should run the specified testRunner', (t) => {
  t.notThrows(() => {
    ruleTester.run('no-direct-chalk-import', rule, {
      valid: [
        {
          code: `import chalk from '../utils'`,
        },
      ],
      invalid: [
        {
          code: `import chalk from 'chalk'`,
          // test the auto fix of the rule
          output: `import {chalk} from './src/utils'`,
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
