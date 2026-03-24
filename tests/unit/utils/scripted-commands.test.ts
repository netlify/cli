import { describe, expect, test, vi, afterEach } from 'vitest'

describe('isNonInteractive', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  const loadModule = async () => {
    const mod = await import('../../../src/utils/scripted-commands.js')
    return mod.isNonInteractive
  }

  test('should return true when CI env var is set', async () => {
    const originalCI = process.env.CI
    process.env.CI = 'true'
    try {
      const isNonInteractive = await loadModule()
      expect(isNonInteractive()).toBe(true)
    } finally {
      if (originalCI === undefined) {
        delete process.env.CI
      } else {
        process.env.CI = originalCI
      }
    }
  })

  test('should return true when stdin is not a TTY', async () => {
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true })
    try {
      const isNonInteractive = await loadModule()
      expect(isNonInteractive()).toBe(true)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
    }
  })

  test('should return true when stdout is not a TTY', async () => {
    const originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    try {
      const isNonInteractive = await loadModule()
      expect(isNonInteractive()).toBe(true)
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true })
    }
  })
})
