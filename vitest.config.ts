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
    snapshotFormat: {
      escapeString: true,
    },
    // Pin to vitest@1 behavior: https://vitest.dev/guide/migration.html#default-pool-is-forks.
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
