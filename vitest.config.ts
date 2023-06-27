import process from 'process'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'tests/**/*.test.mjs',
      'tools/**/*.test.mjs',
      'tests/**/*.test.ts'
    ],
    testTimeout: 60_000,
    deps: {
      external: ['**/fixtures/**', '**/node_modules/**'],
      interopDefault: false,
    },
    reporters: [process.env.DEBUG_TESTS ? 'tap' : 'default'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov'],
    },
  },
})
