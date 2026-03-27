import { describe, test, expect } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { normalize } from '../../utils/snapshots.js'

describe('error handling', () => {
  test('unknown option shows error message', async (t) => {
    await expect(callCli(['status', '--invalid-option'])).rejects.toThrow()

    try {
      await callCli(['status', '--invalid-option'])
    } catch (error) {
      const stderr = (error as { stderr: string }).stderr
      const normalized = normalize(stderr)

      // In interactive mode (test environment), shows brief error
      t.expect(normalized).toContain('Error: unknown option')
      t.expect(normalized).toContain('See more help with --help')
    }
  })

  test('unknown command shows error', async (t) => {
    await expect(callCli(['statuss'])).rejects.toThrow()

    try {
      await callCli(['statuss'])
    } catch (error) {
      const stderr = (error as { stderr: string }).stderr
      const normalized = normalize(stderr)

      // Shows error with help suggestion
      t.expect(normalized).toContain('Error')
      t.expect(normalized).toContain('netlify help')
    }
  })

  test('missing required argument shows error', async (t) => {
    await expect(callCli(['sites:delete'])).rejects.toThrow()

    try {
      await callCli(['sites:delete'])
    } catch (error) {
      const stderr = (error as { stderr: string }).stderr
      const normalized = normalize(stderr)

      t.expect(normalized).toContain('Error:')
      t.expect(normalized).toContain('missing required argument')
    }
  })

  test('help command works correctly', async (t) => {
    const helpOutput = (await callCli(['status', '--help'])) as string
    const normalized = normalize(helpOutput)

    t.expect(normalized).toContain('Print status information')
    t.expect(normalized).toContain('USAGE')
    t.expect(normalized).toContain('OPTIONS')
  })
})
