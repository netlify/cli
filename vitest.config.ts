import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js', 'tests/**/*.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 90_000,
    server: {
      deps: {
        inline: [
          // Force Vitest to preprocess write-file-atomic via Vite, which lets us mock its `fs`
          // import.
          'write-file-atomic',
        ],
      },
    },
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
