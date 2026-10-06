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
    // Vitest 2 made `forks` the default pool; stay on a single thread, one file at a time, as
    // vitest 1 did. File isolation stays on: vitest 4's `isolate: false` shares module mocks
    // between files.
    // TODO(serhalp) Remove this and fix hanging `next-app-without-config` fixture on Windows.
    pool: 'threads',
    maxWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
})
