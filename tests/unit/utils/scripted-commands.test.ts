import { describe, expect, test, vi, afterEach } from 'vitest'

describe('isInteractive', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  const loadModule = async () => {
    const mod = await import('../../../src/utils/scripted-commands.js')
    return mod.isInteractive
  }

  test('should return false when CI env var is set', async () => {
    const originalCI = process.env.CI
    process.env.CI = 'true'
    try {
      const isInteractive = await loadModule()
      expect(isInteractive()).toBe(false)
    } finally {
      if (originalCI === undefined) {
        delete process.env.CI
      } else {
        process.env.CI = originalCI
      }
    }
  })

  test('should return false when stdin is not a TTY', async () => {
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true })
    try {
      const isInteractive = await loadModule()
      expect(isInteractive()).toBe(false)
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
    }
  })

  test('should return false when stdout is not a TTY', async () => {
    const originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    try {
      const isInteractive = await loadModule()
      expect(isInteractive()).toBe(false)
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true })
    }
  })
})
