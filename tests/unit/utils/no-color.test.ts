import { afterEach, describe, expect, test, vi } from 'vitest'

import { shouldDisableColors } from '../../../src/utils/command-helpers.js'

describe('NO_COLOR support', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('shouldDisableColors is true for any non-empty NO_COLOR value', () => {
    expect(shouldDisableColors({ NO_COLOR: '1' })).toBe(true)
    expect(shouldDisableColors({ NO_COLOR: 'true' })).toBe(true)
    expect(shouldDisableColors({ NO_COLOR: '0' })).toBe(true)
  })

  test('shouldDisableColors is false when NO_COLOR is unset or empty', () => {
    expect(shouldDisableColors({})).toBe(false)
    expect(shouldDisableColors({ NO_COLOR: '' })).toBe(false)
  })

  test('chalk is initialized colorless when NO_COLOR is set', async () => {
    vi.stubEnv('NO_COLOR', '1')
    const { chalk } = await import('../../../src/utils/command-helpers.js')
    expect(chalk.level).toBe(0)
    expect(chalk.red('plain')).toBe('plain')
  })
})
