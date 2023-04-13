const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  plugins: ['sort-destructure-keys'],
  parserOptions: {
    babelOptions: {
      parserOpts: {
        sourceType: 'unambiguous',
      },
    },
  },
  rules: {
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    complexity: 0,
    'func-style': 'off',
    'max-depth': 0,
    'max-lines': 0,
    'max-lines-per-function': 0,
    'max-nested-callbacks': 0,
    'max-statements': 0,
    'no-param-reassign': 0,
    'no-process-exit': 0,
    'fp/no-loops': 'error',
    'import/max-dependencies': 0,
    'import/extensions': [2, 'ignorePackages'],
    'n/no-process-exit': 0,
    'n/no-sync': 0,
    'no-magic-numbers': 'off',
    'sort-destructure-keys/sort-destructure-keys': 2,
    'unicorn/consistent-destructuring': 0,
    // TODO: harmonize with filename snake_case in other Netlify Dev projects
    'unicorn/filename-case': [2, { case: 'kebabCase' }],
  },
  overrides: [
    ...overrides,
    // Documentation site's browser JavaScript
    {
      files: ['site/src/**/*.js'],
      parserOptions: {
        sourceType: 'module',
        babelOptions: {
          presets: ['@babel/preset-react'],
          parserOpts: {
            sourceType: 'module',
          },
        },
      },
      rules: {
        complexity: 0,
        'fp/no-this': 0,
        'import/extensions': [2, 'always'],
        'unicorn/consistent-destructuring': 0,
        'max-lines': 0,
      },
    },
    // Example functions
    {
      files: ['src/functions-templates/**/*.js'],
      rules: {
        'require-await': 0,
        'import/no-unresolved': 0,
        'n/no-missing-require': 0,
        'n/no-unsupported-features/es-syntax': 0,
        'import/no-anonymous-default-export': 0,
        'no-undef': 0,
        'no-unused-vars': 0,
        'arrow-body-style': 0,
      },
      parserOptions: {
        sourceType: 'module',
        babelOptions: {
          parserOpts: {
            sourceType: 'module',
          },
        },
      },
    },
    {
      files: ['src/**/*.mjs', 'bin/**/*.mjs'],
      parserOptions: {
        sourceType: 'module',
        babelOptions: {
          parserOpts: {
            sourceType: 'module',
          },
        },
      },
      rules: {
        'import/extensions': [2, 'always'],
        'no-restricted-imports': [
          'error',
          {
            name: 'chalk',
            message:
              'Please use the safe chalk import that handles colors for json output. `import { chalk } from "src/utils/command-helpers.mjs"`',
          },
        ],
      },
    },
    {
      files: ['tests/**/*'],
      rules: {
        'require-await': 'off',
      },
    },
    {
      files: ['*.ts'],
      rules: {
        // Pure ES modules with TypeScript require using `.js` instead of `.ts`
        // in imports
        'import/extensions': 'off',
        'import/no-namespace': 'off',
        'n/no-missing-import': 'off',
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': 'error',
      },
    },
    {
      files: ['tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
}
