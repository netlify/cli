const { overrides } = require('@netlify/eslint-config-node')

module.exports = {
  extends: ['@netlify/eslint-config-node', 'plugin:node/recommended'],
  rules: {
    'node/handle-callback-err': 2,
    'node/no-new-require': 2,
    'node/exports-style': 2,
    'node/file-extension-in-import': 2,
    'node/no-mixed-requires': 2,
    // Browser globals should not use `require()`. Non-browser globals should
    'node/prefer-global/console': 2,
    'node/prefer-global/buffer': [2, 'never'],
    'node/prefer-global/process': [2, 'never'],
    // TODO: enable after dropping support for Node <10.0.0
    'node/prefer-global/url-search-params': 0,
    'node/prefer-global/url': 0,
    // TODO: enable after dropping support for Node <11.0.0
    'node/prefer-global/text-decoder': 0,
    'node/prefer-global/text-encoder': 0,
    // TODO: enable after dropping support for Node <11.4.0
    'node/prefer-promises/fs': 0,
    'node/prefer-promises/dns': 0,
    // This does not work well in a monorepo
    'node/shebang': 0,

    // TODO: enable this
    'no-process-exit': 0,
    // 'node/no-sync': 2,
    // 'node/callback-return': 2,
    // 'node/global-require': 2,

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
        'node/no-missing-require': 0,
      },
    },
  ],
}
