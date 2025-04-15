import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.[jt]s'],
    testTimeout: 600_000,
    // Pin to vitest@1 behavior: https://vitest.dev/guide/migration.html#default-pool-is-forks.
    // TODO(serhalp) Remove this and fix flaky hanging e2e tests on Windows.
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
})
