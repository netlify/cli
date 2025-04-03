// @ts-check
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import eslint from '@eslint/js'
import { includeIgnoreFile } from '@eslint/compat'
import prettier from 'eslint-config-prettier'
import node from 'eslint-plugin-n'
import vitest from '@vitest/eslint-plugin'
import tseslint from 'typescript-eslint'

import cliTemporarySuppressions from './eslint_temporary_suppressions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default tseslint.config(
  // Global rules and configuration
  includeIgnoreFile(path.resolve(__dirname, '.gitignore')),
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  // JavaScript-specific rules
  eslint.configs.recommended,
  // Typescript-specific rules
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.?(c|m)js?(x)'],
    ...tseslint.configs.disableTypeChecked,
  },
  node.configs['flat/recommended'],
  {
    rules: {
      'n/no-extraneous-import': 'off',
      'n/no-extraneous-require': 'off',
      'n/no-missing-import': 'off',
      'n/no-missing-require': 'off',
      'n/no-unpublished-import': 'off',
      'n/no-unpublished-require': 'off',
    },
  },
  // Project-specific rules
  {
    ignores: ['.github/styles/', '**/__fixtures__/'],
  },
  {
    files: ['**/*.?(c|m)ts?(x)'],
    rules: {
      // `interface` and `type` have different use cases, allow both
      '@typescript-eslint/consistent-type-definitions': 'off',

      // Ignore underscore-prefixed unused variables (mirrors tsc behavior)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:process',
              importNames: ['cwd'],
              message: 'Use `command.workingDir` instead.',
            },
            {
              name: 'process',
              importNames: ['cwd'],
              message: 'Use `command.workingDir` instead.',
            },

            {
              name: 'chalk',
              message:
                'Use the safe chalk import that handles colors for json output: `import { chalk } from "src/utils/command-helpers.js"`',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'cwd',
          message: '`process.cwd` is not permitted; use `command.workingDir` instead.',
        },
      ],
    },
  },
  // Tests
  {
    files: ['**/*.test.?(c|m)[jt]s?(x)'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,

      'vitest/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            // Defaults
            'assert',
            'expect',

            // Fix issue where text-context-specific `expect()` calls trigger false positive
            't.expect',
            'ctx.expect',
            'context.expect',

            // Custom assertion functions
            'assertNetlifyToml',
          ],
        },
      ],
    },
  },
  ...cliTemporarySuppressions,
  // Must be last
  prettier,
)
