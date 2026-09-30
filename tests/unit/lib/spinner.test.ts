import { afterEach, describe, expect, test, vi } from 'vitest'

import { startSpinner, stopSpinner } from '../../../src/lib/spinner.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('startSpinner', () => {
  test('animates by default', () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)

    const spinner = startSpinner({ text: 'Deploying' })

    try {
      expect(spinner.isSpinning()).toBe(true)
    } finally {
      stopSpinner({ spinner })
    }
  })

  test('says what it is doing once when ACCESSIBLE is set', () => {
    vi.stubEnv('ACCESSIBLE', '1')
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true)

    const spinner = startSpinner({ text: 'Deploying' })
    stopSpinner({ spinner, text: 'Deployed' })

    expect(spinner.isSpinning()).toBe(false)
    expect(write.mock.calls.map(([text]) => text)).toEqual(['Deploying\n', 'Deployed\n'])
  })

  test('repeats the last text when stopped without one', () => {
    vi.stubEnv('ACCESSIBLE', '1')
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true)

    const spinner = startSpinner({ text: 'Deploying' })
    spinner.update({ text: 'Uploading' })
    stopSpinner({ spinner, error: true })

    expect(write.mock.calls.map(([text]) => text)).toEqual(['Deploying\n', 'Uploading\n'])
  })
})
