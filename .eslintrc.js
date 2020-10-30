const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: ['@netlify/eslint-config-node', 'plugin:promise/recommended', 'plugin:import/recommended'],
  rules: {
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove
    'class-methods-use-this': 0,
    complexity: 0,
    'max-depth': 0,
    'max-lines': 0,
    'max-lines-per-function': 0,
    'max-nested-callbacks': 0,
    'max-statements': 0,
    'no-param-reassign': 0,
    'no-process-exit': 0,
    'fp/no-mutating-methods': 0,
    'fp/no-mutation': 0,
    'import/max-dependencies': 0,
    'node/no-sync': 0,

    // TODO: enable the disabled rules
    'promise/always-return': 0,
    'promise/avoid-new': 0,
    'promise/catch-or-return': 0,
    'promise/no-callback-in-promise': 0,
    'promise/no-nesting': 0,
    'promise/no-promise-in-callback': 2,
    'promise/no-return-in-finally': 2,
    'promise/no-return-wrap': 0,
    'promise/prefer-await-to-callbacks': 0,
    'promise/prefer-await-to-then': 0,
    'promise/valid-params': 2,

    'import/extensions': [2, 'always', { ignorePackages: true }],
    'import/newline-after-import': 2,
    'import/no-amd': 2,
    'import/no-anonymous-default-export': 2,
    'import/no-cycle': [2, { commonjs: true }],
    'import/no-deprecated': 2,
    'import/no-dynamic-require': 2,
    'import/no-extraneous-dependencies': 2,
    'import/no-mutable-exports': 2,
    'import/no-named-default': 2,
    'import/no-namespace': 2,
    'import/no-self-import': 2,
    'import/no-unassigned-import': [2, { allow: ['*polyfill*', '**/*polyfill*', 'log-process-errors/**'] }],
    'import/no-unresolved': [2, { commonjs: true }],
    'import/no-useless-path-segments': [2, { commonjs: true }],

    // TODO: harmonize with filename snake_case in other Netlify Dev projects
    'unicorn/filename-case': [2, { case: 'kebabCase', ignore: ['.*.md'] }],
  },
  overrides: [
    ...overrides,
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
