import type express from 'express'
import { describe, expect, test, vi } from 'vitest'

import { handleSynchronousFunction } from '../../../../src/lib/functions/synchronous.js'

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  logPadded: vi.fn(),
}))

const invokeWithError = async (error: unknown, accept = 'application/json') => {
  const request = { headers: { accept } } as unknown as express.Request
  let body = ''
  const response = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn((chunk?: string) => {
      body = chunk ?? ''
    }),
  } as unknown as express.Response

  await handleSynchronousFunction({
    // @ts-expect-error -- functions can throw values that aren't `Error`s or lambda-local's `InvocationError`
    error,
    functionName: 'hello',
    request,
    response,
    result: null,
  })

  return { statusCode: response.statusCode, body }
}

describe('handleSynchronousFunction', () => {
  test('returns a 500 with the error details for an `Error`', async () => {
    const { statusCode, body } = await invokeWithError(new TypeError('boom'))

    expect(statusCode).toBe(500)
    expect(body).toContain('TypeError: boom')
  })

  test('returns a 500 with the error details for an error from lambda-local', async () => {
    const { statusCode, body } = await invokeWithError({
      errorType: 'TypeError',
      errorMessage: 'boom',
      stackTrace: ['handler (/functions/hello.js:1:1)'],
    })

    expect(statusCode).toBe(500)
    expect(body).toContain('TypeError: boom')
    expect(body).toContain('at handler (/functions/hello.js:1:1)')
  })

  // https://github.com/netlify/cli/issues/6215
  test('returns a 500 for an error from lambda-local without a stack trace', async () => {
    const { statusCode, body } = await invokeWithError({ errorType: 'TypeError', errorMessage: 'boom' })

    expect(statusCode).toBe(500)
    expect(body).toContain('TypeError: boom')
  })

  test('returns a 500 for a thrown object that is not an `Error`', async () => {
    // e.g. `AirtableError` from airtable.js, which lambda-local passes through as is
    const { statusCode, body } = await invokeWithError({
      error: 'NOT_FOUND',
      message: 'Could not find what you are looking for',
      statusCode: 404,
    })

    expect(statusCode).toBe(500)
    expect(body).toContain('Could not find what you are looking for')
  })

  test('renders the error page for a thrown object that is not an `Error`', async () => {
    const { statusCode, body } = await invokeWithError(
      { error: 'NOT_FOUND', message: 'Could not find what you are looking for', statusCode: 404 },
      'text/html',
    )

    expect(statusCode).toBe(500)
    expect(body).toContain('Could not find what you are looking for')
  })

  test('returns a 500 for a thrown string', async () => {
    const { statusCode, body } = await invokeWithError('boom')

    expect(statusCode).toBe(500)
    expect(body).toContain('boom')
  })
})
