import process from 'process'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  envPrefix: ['NETLIFY_'],
  test: {
    include: [
      'tests/**/*.test.mjs',
      'tools/**/*.test.mjs',
      'tests/**/*.test.ts'
    ],
    testTimeout: 60_000,
    hookTimeout: 90_000,
    deps: {
      external: ['**/fixtures/**', '**/node_modules/**'],
      interopDefault: false,
    },
    reporters: [process.env.DEBUG_TESTS ? 'tap' : 'default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
