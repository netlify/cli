const { version } = require('process')

const isNode8 = version.startsWith('v8.')

module.exports = {
  root: true,
  parser: 'babel-eslint',
  plugins: ['prettier', 'markdown', 'html'],
  extends: [
    // This version of eslint-plugin-unicorn requires Node 10
    // TODO: remove after dropping Node 8 support
    ...(isNode8 ? [] : ['plugin:unicorn/recommended']),

    'eslint:recommended',
    'standard',
    'prettier',
    'prettier/standard',
    'plugin:ava/recommended',
    'plugin:react/recommended',
    'prettier/react',
    'plugin:you-dont-need-lodash-underscore/all',
  ],
  rules: {
    'react/prop-types': 0,
    'require-await': 2,
    'no-unused-vars': [2, {}],
    'ava/no-skip-test': 0,

    // This version of eslint-plugin-unicorn requires Node 10
    // TODO: remove after dropping Node 8 support
    ...(isNode8
      ? {}
      : {
          // Not enabled by default in unicorn/recommended, but still pretty useful
          'unicorn/custom-error-definition': 2,
          'unicorn/no-unused-properties': 2,
          // The additional `non-zero` option is useful for code consistency
          'unicorn/explicit-length-check': [2, { 'non-zero': 'not-equal' }],
          // TODO: harmonize with filename snake_case in other Netlify Dev projects
          'unicorn/filename-case': [2, { case: 'kebabCase', ignore: ['.*.md'] }],
          // The `sortCharacterClasses` option is not very useful
          'unicorn/better-regex': [2, { sortCharacterClasses: false }],
          // Too strict
          'unicorn/no-null': 0,
          'unicorn/no-reduce': 0,
          // This rule gives too many false positives
          'unicorn/prevent-abbreviations': 0,
          // Conflicts with Prettier sometimes
          'unicorn/number-literal-case': 0,
          // Conflicts with the core ESLint `prefer-destructuring` rule
          'unicorn/no-unreadable-array-destructuring': 0,
          // Not useful for us
          'unicorn/expiring-todo-comments': 0,
          'unicorn/no-fn-reference-in-iterator': 0,
          // TODO: enable those rules
          'unicorn/no-process-exit': 0,
          'unicorn/import-style': 0,
          // TODO: enable after dropping Node 8 support
          'unicorn/prefer-optional-catch-binding': 0,
          'unicorn/prefer-trim-start-end': 0,
        }),
  },
  overrides: [
    {
      files: ['**/*.md'],
      rules: {
        'no-undef': 0,
        'no-unused-vars': 0,
      },
    },
  ],
  settings: {
    react: {
      version: '16.13.1',
    },
  },
}
