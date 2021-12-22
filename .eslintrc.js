const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: '@netlify/eslint-config-node',
  plugins: ['sort-destructure-keys'],
  rules: {
    // Those rules from @netlify/eslint-config-node are currently disabled
    // TODO: remove, so those rules are enabled
    complexity: 0,
    'max-depth': 0,
    'max-lines': 0,
    'max-lines-per-function': 0,
    'max-nested-callbacks': 0,
    'max-statements': 0,
    'no-param-reassign': 0,
    'no-process-exit': 0,
    'fp/no-loops': 'error',
    'import/max-dependencies': 0,
    'node/no-sync': 0,
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
          plugins: ['@babel/plugin-proposal-class-properties'],
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
        'node/no-missing-require': 0,
        'node/no-unsupported-features/es-syntax': 0,
      },
    },
    {
      files: ['src/**/*.js'],
      rules: {
        // once a solution for npm 6 is found add this to package.json
        // "eslint-plugin-local-rules": "file:tools/eslint-rules",
        // add it to the plugins on top: `plugins: ['sort-destructure-keys', 'local-rules'],`
        //
        // after that uncomment the next line
        // 'local-rules/no-direct-chalk-import': 2,
      },
    },
  ],
}
