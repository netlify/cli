'use strict'

const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  parserOptions: {
    sourceType: 'script',
  },
  rules: {
    strict: 2,

    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    'class-methods-use-this': 0,
    complexity: 0,
    'max-depth': 0,
    'max-lines': 0,
    'max-lines-per-function': 0,
    'max-nested-callbacks': 0,
    'max-statements': 0,
    'no-param-reassign': 0,
    'no-process-exit': 0,
    'fp/no-class': 0,
    'fp/no-delete': 0,
    'fp/no-get-set': 0,
    'fp/no-let': 0,
    'fp/no-loops': 0,
    'fp/no-mutating-assign': 0,
    'fp/no-mutating-methods': 0,
    'fp/no-mutation': 0,
    'fp/no-proxy': 0,
    'fp/no-this': 0,
    'import/max-dependencies': 0,
    'node/no-sync': 0,
    'promise/catch-or-return': 0,
    'promise/no-callback-in-promise': 0,
    'promise/no-nesting': 0,
    'promise/no-return-wrap': 0,
    'promise/prefer-await-to-callbacks': 0,
    'promise/prefer-await-to-then': 0,

    // TODO: harmonize with filename snake_case in other Netlify Dev projects
    'unicorn/filename-case': [2, { case: 'kebabCase', ignore: ['.*.md'] }],
  },
  overrides: [
    ...overrides,
    {
      files: ['**/*.md'],
      rules: {
        strict: 0,
      },
    },
    // Documentation site's browser JavaScript
    {
      files: ['site/src/**/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
      rules: {
        'node/no-unsupported-features/es-syntax': 0,
      },
    },
    // Example functions
    {
      files: ['src/functions-templates/**/*.js'],
      rules: {
        'require-await': 0,
        'import/no-unresolved': 0,
        'node/no-missing-require': 0,
      },
    },
  ],
}
