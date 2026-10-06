import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.[jt]s'],
    testTimeout: 1200_000,
    // Vitest 2 made `forks` the default pool; stay on a single thread, one file at a time, as
    // vitest 1 did. File isolation stays on: vitest 4's `isolate: false` shares module mocks
    // between files.
    // TODO(serhalp) Remove this and fix flaky hanging e2e tests on Windows.
    pool: 'threads',
    maxWorkers: 1,
  },
})
