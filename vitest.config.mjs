/// <reference types="vitest" />
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.mjs'],
    testTimeout: 30_000,
    deps: {
      external: ['**/fixtures/**', '**/node_modules/**'],
      interopDefault: false,
    },
    coverage: {
      provider: 'c8',
      reporter: ['text', 'lcov'],
    },
  },
})
