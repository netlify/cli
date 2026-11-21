import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../src/commands/base-command.js'
import { exit, logError } from '../../../src/utils/command-helpers.js'
import { EXIT_CODES } from '../../../src/utils/exit-codes.js'

vi.mock('../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../src/utils/command-helpers.js')),
  exit: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('../../../src/utils/telemetry/index.js', async () => ({
  ...(await vi.importActual('../../../src/utils/telemetry/index.js')),
  track: vi.fn(),
}))

describe('BaseCommand.onEnd', () => {
  beforeEach(() => {
    vi.mocked(exit).mockClear()
    vi.mocked(logError).mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('logs other errors and exits with code 1', async () => {
    const error = new Error('Something broke')

    await new BaseCommand('netlify').onEnd(error)

    expect(logError).toHaveBeenCalledWith(error)
    expect(exit).toHaveBeenCalledWith(EXIT_CODES.GENERAL_ERROR)
  })

  test('does not exit when the command succeeded', async () => {
    await new BaseCommand('netlify').onEnd()

    expect(exit).not.toHaveBeenCalled()
  })
})
