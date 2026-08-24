import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { deepMerge, isEmpty, pick, throttle } from '../../../src/utils/object-utilities.js'

describe('isEmpty', () => {
  test('returns true for null', () => {
    expect(isEmpty(null)).toBe(true)
  })

  test('returns true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true)
  })

  test('returns true for an empty object', () => {
    expect(isEmpty({})).toBe(true)
  })

  test('returns false for an object with properties', () => {
    expect(isEmpty({ a: 1 })).toBe(false)
  })

  test('returns false for an object with falsy values', () => {
    expect(isEmpty({ a: null })).toBe(false)
    expect(isEmpty({ a: undefined })).toBe(false)
    expect(isEmpty({ a: 0 })).toBe(false)
    expect(isEmpty({ a: '' })).toBe(false)
  })

  test('returns true for an empty array', () => {
    expect(isEmpty([])).toBe(true)
  })

  test('returns false for a non-empty array', () => {
    expect(isEmpty([1])).toBe(false)
  })
})

describe('pick', () => {
  test('returns a new object containing only the requested keys', () => {
    const source = { a: 1, b: 2, c: 3 }
    expect(pick(source, ['a', 'c'])).toEqual({ a: 1, c: 3 })
  })

  test('skips keys that are not present on the source', () => {
    const source = { a: 1, b: 2 }
    expect(pick(source, ['a', 'missing'])).toEqual({ a: 1 })
  })

  test('returns an empty object when no keys are requested', () => {
    expect(pick({ a: 1 }, [])).toEqual({})
  })

  test('returns an empty object when no requested keys exist on the source', () => {
    expect(pick({ a: 1 }, ['b', 'c'])).toEqual({})
  })

  test('does not mutate the source object', () => {
    const source = { a: 1, b: 2 }
    pick(source, ['a'])
    expect(source).toEqual({ a: 1, b: 2 })
  })

  test('preserves falsy values', () => {
    const source = { a: 0, b: false, c: null, d: '', e: 1 }
    expect(pick(source, ['a', 'b', 'c', 'd'])).toEqual({ a: 0, b: false, c: null, d: '' })
  })

  test('accepts extra string keys not declared on the source type', () => {
    const source: { id: string } = { id: 'abc' }
    const sourceWithExtras = { ...source, undeclared: 'extra' } as { id: string }
    expect(pick(sourceWithExtras, ['id', 'undeclared'])).toEqual({ id: 'abc', undeclared: 'extra' })
  })
})

describe('deepMerge', () => {
  test('treats undefined target as an empty object', () => {
    expect(deepMerge<Record<string, unknown>>(undefined, { a: 1 })).toEqual({ a: 1 })
  })

  test('merges top-level keys from the source into the target', () => {
    expect(deepMerge({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  test('source values overwrite target values at the same key', () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })

  test('recursively merges nested plain objects', () => {
    const target = { auth: { token: 'old', provider: 'github' } }
    const source = { auth: { token: 'new' } }
    expect(deepMerge(target, source)).toEqual({ auth: { token: 'new', provider: 'github' } })
  })

  test('overwrites arrays instead of merging them', () => {
    const target = { list: [1, 2, 3] }
    const source = { list: [4] }
    expect(deepMerge(target, source)).toEqual({ list: [4] })
  })

  test('overwrites target values with null from source', () => {
    const target = { a: 1 }
    const source = { a: null }
    expect(deepMerge(target, source)).toEqual({ a: null })
  })

  test('skips undefined source values to preserve existing target values (lodash.merge parity)', () => {
    const target = { auth: { token: 'existing', github: { user: 'octocat', token: 'gh-token' } } }
    const source = { auth: { github: { user: undefined, token: undefined } } }
    expect(deepMerge(target, source)).toEqual({
      auth: { token: 'existing', github: { user: 'octocat', token: 'gh-token' } },
    })
  })

  test('skips top-level undefined source values', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({ a: 1, b: 3 })
  })

  test('does not mutate the target object', () => {
    const target = { auth: { token: 'old' } }
    deepMerge(target, { auth: { token: 'new' } })
    expect(target).toEqual({ auth: { token: 'old' } })
  })

  test('does not mutate the source object', () => {
    const source = { auth: { token: 'new' } }
    deepMerge({ auth: { token: 'old' } }, source)
    expect(source).toEqual({ auth: { token: 'new' } })
  })
})

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('invokes the underlying function immediately on first call', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('drops calls that arrive within the throttle interval and schedules no trailing invocation', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()
    vi.advanceTimersByTime(50)
    throttled()
    throttled()

    expect(fn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(200)

    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('allows a subsequent call after the interval has elapsed', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled()
    vi.advanceTimersByTime(100)
    throttled()

    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('forwards all arguments to the underlying function', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled('a', 1, { x: true })

    expect(fn).toHaveBeenCalledWith('a', 1, { x: true })
  })
})
