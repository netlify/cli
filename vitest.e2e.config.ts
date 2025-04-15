import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.[jt]s'],
    testTimeout: 600_000,
  },
})
