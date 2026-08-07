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

  test('should return false when --non-interactive is passed', async () => {
    const originalArgv = process.argv
    process.argv = [...originalArgv, '--non-interactive']
    try {
      const isInteractive = await loadModule()
      expect(isInteractive()).toBe(false)
    } finally {
      process.argv = originalArgv
    }
  })
})

describe('shouldForceFlagBeInjected', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  test('treats --non-interactive like CI and injects --force', async () => {
    const { shouldForceFlagBeInjected } = await import('../../../src/utils/scripted-commands.js')
    expect(shouldForceFlagBeInjected(['node', 'netlify', 'env:set', '--non-interactive'])).toBe(true)
  })

  test('does not inject --force twice', async () => {
    const { shouldForceFlagBeInjected } = await import('../../../src/utils/scripted-commands.js')
    expect(shouldForceFlagBeInjected(['node', 'netlify', 'env:set', '--non-interactive', '--force'])).toBe(false)
  })
})

describe('failOnNonInteractivePrompt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  test('exits with code 4 and names the prompt and the remediation on stderr', async () => {
    const { failOnNonInteractivePrompt } = await import('../../../src/utils/scripted-commands.js')
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${String(code ?? 0)})`)
    }) as never)

    expect(() => {
      failOnNonInteractivePrompt('Which project do you want to link?', 'Pass --id <project-id> or --name <name>.')
    }).toThrow('process.exit(4)')

    expect(exitSpy).toHaveBeenCalledWith(4)
    const output = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('')
    expect(output).toContain('non-interactive mode')
    expect(output).toContain('--non-interactive')
    expect(output).toContain('Which project do you want to link?')
    expect(output).toContain('Pass --id <project-id> or --name <name>.')
  })
})
