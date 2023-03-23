import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.mjs'],
    testTimeout: 600_000,
    deps: {
      external: ['**/fixtures/**', '**/node_modules/**'],
      interopDefault: false,
    },
  },
})
