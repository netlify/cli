import type { OptionValues } from 'commander'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../../../../src/utils/telemetry/report-error.js', () => ({
  reportError: vi.fn().mockResolvedValue(undefined),
}))

import { apiCommand } from '../../../../src/commands/api/api.js'
import type BaseCommand from '../../../../src/commands/base-command.js'

const getSite = vi.fn()

const command = { netlify: { api: { getSite } } } as unknown as BaseCommand

const runApi = async (data: string) => apiCommand('getSite', { data } as OptionValues, command)

const captureError = async (data: string): Promise<Error> => {
  try {
    await runApi(data)
  } catch (error) {
    return error as Error
  }
  throw new Error('expected apiCommand to throw')
}

describe('apiCommand --data parsing', () => {
  beforeEach(() => {
    getSite.mockReset()
  })

  test('rejects key=value input with an error naming --data', async () => {
    await expect(runApi('site_id=123')).rejects.toThrowError(/--data/)
    expect(getSite).not.toHaveBeenCalled()
  })

  test('error echoes the offending input and a concrete JSON example', async () => {
    const error = await captureError('site_id=123')
    expect(error.message).toContain('site_id=123')
    expect(error.message).toContain(`--data '{"site_id":"123456"}'`)
    expect(error.message).toContain('key=value')
    expect(error.message).not.toContain('SyntaxError')
  })

  test('truncates long offending input in the error message', async () => {
    const longInput = `site_id=${'9'.repeat(200)}`
    const error = await captureError(longInput)
    expect(error.message).not.toContain(longInput)
    expect(error.message).toContain(longInput.slice(0, 80))
  })

  test('still accepts a valid JSON object string', async () => {
    getSite.mockResolvedValue({ id: '123456' })

    await runApi('{"site_id":"123456"}')

    expect(getSite).toHaveBeenCalledWith({ site_id: '123456' })
  })

  test('names --data and the required variable when the API reports a missing path variable', async () => {
    getSite.mockRejectedValue(new Error("Missing required path variable 'site_id'"))

    const error = await captureError('{"other":"value"}')
    expect(error.message).toContain('--data')
    expect(error.message).toContain('site_id')
  })
})
