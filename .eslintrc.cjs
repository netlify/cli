const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  plugins: [
    'sort-destructure-keys',
    // custom workspace lint rules found under `./tools/lint-rules`
    'workspace',
  ],
  parserOptions: {
    ecmaVersion: '2020',
    babelOptions: {
      parserOpts: {
        sourceType: 'unambiguous',
      },
    },
  },
  // .js files in this folder are compiled from TS
  ignorePatterns: ['src/**/*.js'],
  rules: {
    'workspace/no-process-cwd': 'error',
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    complexity: 0,
    'no-inline-comments': 'off',
    'func-style': 'off',
    'max-depth': 0,
    'max-lines': 0,
    'max-lines-per-function': 0,
    'max-nested-callbacks': 0,
    'max-statements': 0,
    'no-param-reassign': 0,
    'no-process-exit': 0,
    'fp/no-loops': 'off',
    'import/max-dependencies': 0,
    'import/no-dynamic-require': 0,
    'import/extensions': [2, 'ignorePackages'],
    'n/no-process-exit': 0,
    'n/no-sync': 0,
    'no-magic-numbers': 'off',
    'sort-destructure-keys/sort-destructure-keys': 2,
    'unicorn/consistent-destructuring': 0,
    // TODO: harmonize with filename snake_case in other Netlify Dev projects
    'unicorn/filename-case': [2, { case: 'kebabCase' }],
    'max-params': 'off',
    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': 'off',
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
      files: ['functions-templates/**/*.mjs', 'functions-templates/**/*.mts'],
      rules: {
        'require-await': 0,
        'import/no-unresolved': 0,
        'n/no-missing-require': 0,
        'n/no-unsupported-features/es-syntax': 0,
        'import/no-anonymous-default-export': 0,
        'no-undef': 0,
        'no-unused-vars': 0,
        'arrow-body-style': 0,
        'n/no-unsupported-features/node-builtins': 0,
        camelcase: 0,
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
      files: ['bin/**/*.js'],
      parserOptions: {
        ecmaVersion: '2020',
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
              'Please use the safe chalk import that handles colors for json output. `import { chalk } from "src/utils/command-helpers.js"`',
          },
        ],
      },
    },
    {
      files: ['tests/**/*'],
      rules: {
        'require-await': 'off',
        'import/no-deprecated': 'off',
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
        '@typescript-eslint/no-empty-function': 'off',
      },
    },
  ],
}
