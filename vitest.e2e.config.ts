import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.[jt]s'],
    testTimeout: 1200_000,
    // Use forks pool for better process isolation and prevent hanging tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
        isolate: true,
      },
    },
    // Ensure proper cleanup between tests
    sequence: {
      concurrent: false,
    },
    // Add retry for network-dependent E2E tests
    retry: 2,
  },
})
