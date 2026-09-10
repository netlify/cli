import { describe, expect, test, vi } from 'vitest'

import { isBrokenPipe, log, normalizeConfig } from '../../../src/utils/command-helpers.js'

describe('normalizeConfig', () => {
  test('should remove publish and publishOrigin property if publishOrigin is "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'default' } }

    // @ts-expect-error TS(2345) FIXME: Argument of type '{ build: { publish: string; publ... Remove this comment to see the full error message
    expect(normalizeConfig(config)).toEqual({ build: {} })
  })

  test('should return same config object if publishOrigin is not "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'b' } }

    // @ts-expect-error TS(2345) FIXME: Argument of type '{ build: { publish: string; publ... Remove this comment to see the full error message
    expect(normalizeConfig(config)).toBe(config)
  })
})

describe('isBrokenPipe', () => {
  test('matches EPIPE and destroyed stream codes', () => {
    expect(isBrokenPipe({ code: 'EPIPE' })).toBe(true)
    expect(isBrokenPipe({ code: 'ERR_STREAM_DESTROYED' })).toBe(true)
    expect(isBrokenPipe({ code: 'EIO' })).toBe(false)
    expect(isBrokenPipe(null)).toBe(false)
  })
})

describe('log', () => {
  test('exits 0 when stdout write throws EPIPE', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => {
      const err = new Error('broken pipe') as NodeJS.ErrnoException
      err.code = 'EPIPE'
      throw err
    })
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exited')
    })

    expect(() => log('hello')).toThrow('exited')
    expect(exit).toHaveBeenCalledWith(0)

    write.mockRestore()
    exit.mockRestore()
  })
})


describe('normalizeConfig', () => {
  test('should remove publish and publishOrigin property if publishOrigin is "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'default' } }

    // @ts-expect-error TS(2345) FIXME: Argument of type '{ build: { publish: string; publ... Remove this comment to see the full error message
    expect(normalizeConfig(config)).toEqual({ build: {} })
  })

  test('should return same config object if publishOrigin is not "default"', () => {
    const config = { build: { publish: 'a', publishOrigin: 'b' } }

    // @ts-expect-error TS(2345) FIXME: Argument of type '{ build: { publish: string; publ... Remove this comment to see the full error message
    expect(normalizeConfig(config)).toBe(config)
  })
})
