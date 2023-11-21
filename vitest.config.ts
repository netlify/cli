import process from 'process'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js', 'tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    deps: {
      external: ['**/fixtures/**', '**/node_modules/**'],
      interopDefault: false,
    },
    snapshotFormat: {
      escapeString: true,
    },
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    reporters: [process.env.DEBUG_TESTS ? 'tap' : 'default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
