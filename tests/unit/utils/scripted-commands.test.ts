import { afterEach, describe, expect, test, vi } from 'vitest'

// ci-info computes `isCI` once at import time, so the module under test is re-imported per test with an
// explicit value to keep results independent of the environment running this suite.
const loadModule = async ({ isCI = false } = {}) => {
  vi.doMock('ci-info', () => ({ isCI }))
  return import('../../../src/utils/scripted-commands.js')
}

const restoreTTYs: (() => void)[] = []

const stubTTY = (stream: { isTTY?: boolean }, isTTY: boolean | undefined) => {
  const original = stream.isTTY
  Object.defineProperty(stream, 'isTTY', { value: isTTY, configurable: true })
  restoreTTYs.push(() => {
    Object.defineProperty(stream, 'isTTY', { value: original, configurable: true })
  })
}

const stubInteractiveTerminal = () => {
  stubTTY(process.stdin, true)
  stubTTY(process.stdout, true)
  vi.stubEnv('CI', undefined)
  vi.stubEnv('TESTING_PROMPTS', undefined)
}

afterEach(() => {
  restoreTTYs.splice(0).forEach((restore) => {
    restore()
  })
  vi.unstubAllEnvs()
  vi.doUnmock('ci-info')
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('isInteractive', () => {
  test('should return true when stdin and stdout are TTYs outside CI', async () => {
    stubInteractiveTerminal()
    const { isInteractive } = await loadModule()
    expect(isInteractive()).toBe(true)
  })

  test('should return false when CI env var is set', async () => {
    stubInteractiveTerminal()
    vi.stubEnv('CI', 'true')
    const { isInteractive } = await loadModule()
    expect(isInteractive()).toBe(false)
  })

  test('should return false when ci-info detects a CI vendor', async () => {
    stubInteractiveTerminal()
    const { isInteractive } = await loadModule({ isCI: true })
    expect(isInteractive()).toBe(false)
  })

  test('should return false when stdin is not a TTY', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    const { isInteractive } = await loadModule()
    expect(isInteractive()).toBe(false)
  })

  test('should return false when stdout is not a TTY', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdout, undefined)
    const { isInteractive } = await loadModule()
    expect(isInteractive()).toBe(false)
  })
})

describe('shouldForceFlagBeInjected', () => {
  const argv = ['node', 'netlify', 'env:set', 'FOO', 'bar']

  test('should return true when stdin is not a TTY and --force is absent', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    const { shouldForceFlagBeInjected } = await loadModule()
    expect(shouldForceFlagBeInjected(argv)).toBe(true)
  })

  test('should return true when CI env var is set even if stdin is a TTY', async () => {
    stubInteractiveTerminal()
    vi.stubEnv('CI', 'true')
    const { shouldForceFlagBeInjected } = await loadModule()
    expect(shouldForceFlagBeInjected(argv)).toBe(true)
  })

  test('should return true when ci-info detects a CI vendor even if stdin is a TTY', async () => {
    stubInteractiveTerminal()
    const { shouldForceFlagBeInjected } = await loadModule({ isCI: true })
    expect(shouldForceFlagBeInjected(argv)).toBe(true)
  })

  test('should return false when --force is already present', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    const { shouldForceFlagBeInjected } = await loadModule()
    expect(shouldForceFlagBeInjected([...argv, '--force'])).toBe(false)
  })

  test('should return false when TESTING_PROMPTS is true even if stdin is not a TTY', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    vi.stubEnv('TESTING_PROMPTS', 'true')
    const { shouldForceFlagBeInjected } = await loadModule()
    expect(shouldForceFlagBeInjected(argv)).toBe(false)
  })

  test('should return false when interactive', async () => {
    stubInteractiveTerminal()
    const { shouldForceFlagBeInjected } = await loadModule()
    expect(shouldForceFlagBeInjected(argv)).toBe(false)
  })
})

describe('injectForceFlagIfScripted', () => {
  test('should append --force to argv when scripted', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    const { injectForceFlagIfScripted } = await loadModule()
    const argv = ['node', 'netlify', 'env:set', 'FOO', 'bar']
    injectForceFlagIfScripted(argv)
    expect(argv).toEqual(['node', 'netlify', 'env:set', 'FOO', 'bar', '--force'])
  })

  test('should not duplicate --force when already present', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    const { injectForceFlagIfScripted } = await loadModule()
    const argv = ['node', 'netlify', 'env:set', 'FOO', 'bar', '--force']
    injectForceFlagIfScripted(argv)
    expect(argv).toEqual(['node', 'netlify', 'env:set', 'FOO', 'bar', '--force'])
  })

  test('should leave argv unchanged when TESTING_PROMPTS is true', async () => {
    stubInteractiveTerminal()
    stubTTY(process.stdin, undefined)
    vi.stubEnv('TESTING_PROMPTS', 'true')
    const { injectForceFlagIfScripted } = await loadModule()
    const argv = ['node', 'netlify', 'env:set', 'FOO', 'bar']
    injectForceFlagIfScripted(argv)
    expect(argv).toEqual(['node', 'netlify', 'env:set', 'FOO', 'bar'])
  })

  test('should leave argv unchanged when interactive', async () => {
    stubInteractiveTerminal()
    const { injectForceFlagIfScripted } = await loadModule()
    const argv = ['node', 'netlify', 'env:set', 'FOO', 'bar']
    injectForceFlagIfScripted(argv)
    expect(argv).toEqual(['node', 'netlify', 'env:set', 'FOO', 'bar'])
  })
})
