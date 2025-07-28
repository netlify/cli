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
    // Use forks pool for better process isolation and prevent test interference
    pool: 'forks',
    poolOptions: {
      forks: {
        // Allow multiple forks for better performance while maintaining isolation
        maxForks: 4,
        minForks: 1,
        isolate: true,
      },
    },
    // Prevent flaky tests from concurrent execution
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
