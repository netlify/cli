module.exports = {
  parser: 'babel-eslint',
  plugins: ['prettier', 'markdown', 'html'],
  extends: [
    'eslint:recommended',
    'standard',
    'prettier',
    'prettier/standard',
    'plugin:unicorn/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:ava/recommended',
    'plugin:react/recommended',
    'prettier/react',
    'plugin:you-dont-need-lodash-underscore/all',
  ],
  reportUnusedDisableDirectives: true,
  rules: {
    'require-await': 2,
    'no-unused-vars': [2, {}],
    'no-undef': [2, { typeof: true }],
    'ava/no-skip-test': 0,

    // Those ESLint rules are not enabled by Prettier, ESLint recommended rules
    // nor standard JavaScript. However, they are still useful
    'array-callback-return': [2, { allowImplicit: true, checkForEach: true }],
    'block-scoped-var': 2,
    'consistent-this': 2,
    'default-case': 2,
    'default-case-last': 2,
    'default-param-last': 2,
    'func-name-matching': [2, { considerPropertyDescriptor: true }],
    'func-names': [2, 'as-needed'],
    'id-length': [2, { exceptions: ['t', '_'] }],
    'line-comment-position': 2,
    'max-classes-per-file': 2,
    'max-params': [2, { max: 4 }],
    'multiline-comment-style': [2, 'separate-lines'],
    'no-await-in-loop': 2,
    'no-bitwise': 2,
    'no-constructor-return': 2,
    'no-duplicate-imports': 2,
    'no-else-return': [2, { allowElseIf: false }],
    'no-extra-label': 2,
    'no-implicit-coercion': 2,
    'no-implicit-globals': [2, { lexicalBindings: true }],
    'no-inline-comments': 2,
    'no-invalid-this': 2,
    'no-label-var': 2,
    'no-lonely-if': 2,
    'no-loop-func': 2,
    'no-loss-of-precision': 2,
    'no-magic-numbers': [
      2,
      {
        ignore: [
          // Common small numbers
          -2,
          -1,
          0,
          1,
          2,
          3,
          // HTTP statuses
          200,
          201,
          204,
          300,
          301,
          400,
          401,
          403,
          404,
          410,
          422,
          500,
        ],
        enforceConst: true,
        detectObjects: true,
      },
    ],
    'no-multi-assign': 2,
    'no-negated-condition': 2,
    'no-nested-ternary': 2,
    'no-plusplus': [2, { allowForLoopAfterthoughts: true }],
    'no-promise-executor-return': 2,
    'no-return-await': 2,
    'no-shadow': 2,
    'no-underscore-dangle': [2, { enforceInMethodNames: true }],
    'no-unreachable-loop': 2,
    'no-useless-backreference': 2,
    'no-useless-computed-key': [2, { enforceForClassMembers: true }],
    'no-useless-concat': 2,
    'no-var': 2,
    'object-shorthand': 2,
    'operator-assignment': 2,
    'padding-line-between-statements': 2,
    'prefer-destructuring': 2,
    'prefer-exponentiation-operator': 2,
    'prefer-numeric-literals': 2,
    'prefer-object-spread': 2,
    'prefer-regex-literals': [2, { disallowRedundantWrapping: true }],
    'prefer-rest-params': 2,
    'prefer-spread': 2,
    'prefer-template': 2,
    radix: [2, 'as-needed'],

    // TODO: enable the following rules
    // 'class-methods-use-this': 2,
    // 'no-param-reassign': [
    //   2,
    //   {
    //     props: true,
    //     ignorePropertyModificationsFor: ['error', 'req', 'request', 'res', 'response', 'state', 'runState', 't'],
    //   },
    // ],
    // strict: 2,

    'eslint-comments/no-unused-disable': 0,
    'eslint-comments/no-use': [
      2,
      { allow: ['eslint-disable-next-line', 'eslint-disable', 'eslint-enable', 'eslint-env'] },
    ],

    'import/order': [
      2,
      {
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],

    'react/prop-types': 0,

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
  },
  overrides: [
    {
      files: '**/*.test.js',
      rules: {
        'node/no-unpublished-require': 0,
        'node/no-missing-require': 0,
      },
    },
    {
      files: 'src/functions-templates/**/*.js',
      rules: {
        'require-await': 0,
      },
    },
    {
      files: ['**/*.md'],
      rules: {
        'no-undef': 0,
        'no-unused-vars': 0,
        // Inline comments making code samples vertically shorter are useful
        'line-comment-position': 0,
        'no-inline-comments': 0,
      },
    },
  ],
  settings: {
    react: {
      version: '16.13.1',
    },
  },
}
