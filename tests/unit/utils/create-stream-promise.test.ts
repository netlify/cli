import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, test, vi } from 'vitest'
import createStreamPromise from '../../../src/utils/create-stream-promise.js'

afterEach(() => vi.useRealTimers())

describe('createStreamPromise', () => {
  test('clears the request timeout when the size limit rejects a live stream', async () => {
    vi.useFakeTimers()
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 30, 2)
    stream.write(Buffer.from('abc'))
    await expect(body).rejects.toThrow('Stream body too big')
    expect(vi.getTimerCount()).toBe(0)
  })

  test('rejects a closed stream promptly instead of waiting for the request timeout', async () => {
    vi.useFakeTimers()
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 30)
    const rejected = body.catch((error: unknown) => error)
    stream.emit('close')
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(await rejected).toBeInstanceOf(Error)
    expect(((await rejected) as Error).message).toMatch(
      /Stream closed before body completed|Request timed out waiting for body/,
    )
  })

  test('rejects premature closure even without a timeout', async () => {
    const stream = new PassThrough()
    const body = createStreamPromise(stream, Number.POSITIVE_INFINITY)
    const rejected = body.catch((error: unknown) => error)
    stream.destroy()
    expect(await rejected).toBeInstanceOf(Error)
    expect(((await rejected) as Error).message).toMatch(
      /Stream closed before body completed|Request timed out waiting for body/,
    )
  })

  test('ignores later events after a size rejection', async () => {
    vi.useFakeTimers()
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 30, 2)
    stream.write(Buffer.from('abc'))
    await expect(body).rejects.toThrow('Stream body too big')
    stream.emit('error', new Error('later error'))
    stream.emit('close')
    stream.end()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('joins chunks when the stream ends normally', async () => {
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 30)
    stream.write(Buffer.from('ab'))
    stream.end(Buffer.from('cd'))
    await expect(body).resolves.toEqual(Buffer.from('abcd'))
  })

  test('preserves stream errors and clears the timeout', async () => {
    vi.useFakeTimers()
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 30)
    const error = new Error('read failed')
    stream.emit('error', error)
    await expect(body).rejects.toBe(error)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('still rejects a stalled stream at the timeout', async () => {
    vi.useFakeTimers()
    const stream = new PassThrough()
    const body = createStreamPromise(stream, 1)
    const rejected = body.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(1000)
    expect(await rejected).toBeInstanceOf(Error)
    expect(((await rejected) as Error).message).toMatch(
      /Stream closed before body completed|Request timed out waiting for body/,
    )
    expect(vi.getTimerCount()).toBe(0)
  })
})
