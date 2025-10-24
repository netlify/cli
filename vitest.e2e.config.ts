import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.[jt]s'],
    testTimeout: 1200_000,
    // Pin to vitest@1 behavior: https://vitest.dev/guide/migration.html#default-pool-is-forks.
    pool: 'threads',
  },
})
