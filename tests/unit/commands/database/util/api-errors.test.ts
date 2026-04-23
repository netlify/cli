import { describe, expect, test } from 'vitest'

import { readApiErrorMessage } from '../../../../../src/commands/database/util/api-errors.js'

const makeResponse = (text: string): Response => ({ text: () => Promise.resolve(text) } as unknown as Response)

describe('readApiErrorMessage', () => {
  test('extracts the `message` field from a JSON error body', async () => {
    const response = makeResponse(JSON.stringify({ code: 404, message: 'database not found' }))
    expect(await readApiErrorMessage(response)).toBe('database not found')
  })

  test('falls back to the raw body when it is not JSON', async () => {
    const response = makeResponse('plain text error')
    expect(await readApiErrorMessage(response)).toBe('plain text error')
  })

  test('falls back to the raw body when JSON has no `message` field', async () => {
    const response = makeResponse(JSON.stringify({ code: 500 }))
    expect(await readApiErrorMessage(response)).toBe(JSON.stringify({ code: 500 }))
  })

  test('falls back to the raw body when `message` is blank', async () => {
    const body = JSON.stringify({ code: 500, message: '   ' })
    const response = makeResponse(body)
    expect(await readApiErrorMessage(response)).toBe(body)
  })

  test('returns empty string when body is empty', async () => {
    const response = makeResponse('')
    expect(await readApiErrorMessage(response)).toBe('')
  })
})
