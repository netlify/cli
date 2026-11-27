import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import process from 'process'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import {
  getTokenExpiry,
  getUsableToken,
  readAccessTokenCache,
  writeAccessTokenCache,
} from '../../../../src/commands/curl/access-token-cache.js'

const createJWT = (payload: Record<string, unknown>) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'signature'].join('.')

const now = Math.floor(Date.now() / 1000)

describe('getTokenExpiry', () => {
  test('returns the exp claim of a JWT', () => {
    expect(getTokenExpiry(createJWT({ exp: 1_800_000_000, site_id: 'abc' }))).toBe(1_800_000_000)
  })

  test('returns undefined for tokens without an expiry or that are not JWTs', () => {
    expect(getTokenExpiry(createJWT({ site_id: 'abc' }))).toBeUndefined()
    expect(getTokenExpiry('opaque-token')).toBeUndefined()
    expect(getTokenExpiry('a.not-base64-json.c')).toBeUndefined()
  })
})

test('getUsableToken returns a token only while it has at least five minutes left', () => {
  const cache = new Map([
    ['fresh--mysitename.netlify.app', { token: 'fresh', expiresAt: now + 3600 }],
    ['ending--mysitename.netlify.app', { token: 'ending', expiresAt: now + 200 }],
    ['expired--mysitename.netlify.app', { token: 'expired', expiresAt: now - 1 }],
  ])

  expect(getUsableToken(cache, 'fresh--mysitename.netlify.app', now)).toBe('fresh')
  expect(getUsableToken(cache, 'ending--mysitename.netlify.app', now)).toBeUndefined()
  expect(getUsableToken(cache, 'expired--mysitename.netlify.app', now)).toBeUndefined()
  expect(getUsableToken(cache, 'missing--mysitename.netlify.app', now)).toBeUndefined()
})

describe('access token cache file', () => {
  let directory: string
  let path: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'curl-cache-test-'))
    path = join(directory, 'nested', 'access-tokens')
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  test('reads back what was written with the same API token', async () => {
    const cache = new Map([['mysitename.netlify.app', { token: 'jwt-a', expiresAt: now + 3600 }]])

    await writeAccessTokenCache(path, 'api-token', cache)

    expect(await readAccessTokenCache(path, 'api-token')).toEqual(cache)
  })

  test('stores the tokens encrypted', async () => {
    await writeAccessTokenCache(
      path,
      'api-token',
      new Map([['mysitename.netlify.app', { token: 'jwt-a', expiresAt: now + 3600 }]]),
    )

    const contents = await readFile(path)
    expect(contents.includes('jwt-a')).toBe(false)
    expect(contents.includes('mysitename.netlify.app')).toBe(false)
  })

  test.skipIf(process.platform === 'win32')('is readable only by the current user', async () => {
    await writeAccessTokenCache(path, 'api-token', new Map())

    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  test('leaves out expired entries', async () => {
    await writeAccessTokenCache(
      path,
      'api-token',
      new Map([
        ['fresh--mysitename.netlify.app', { token: 'fresh', expiresAt: now + 3600 }],
        ['expired--mysitename.netlify.app', { token: 'expired', expiresAt: now - 1 }],
      ]),
      now,
    )

    expect([...(await readAccessTokenCache(path, 'api-token')).keys()]).toEqual(['fresh--mysitename.netlify.app'])
  })

  test('leaves no temporary files behind', async () => {
    await writeAccessTokenCache(path, 'api-token', new Map())
    await writeAccessTokenCache(path, 'api-token', new Map())

    expect(await readdir(join(directory, 'nested'))).toEqual(['access-tokens'])
  })

  test('is empty when read with a different API token', async () => {
    await writeAccessTokenCache(
      path,
      'api-token',
      new Map([['mysitename.netlify.app', { token: 'jwt-a', expiresAt: now + 3600 }]]),
    )

    expect(await readAccessTokenCache(path, 'other-api-token')).toEqual(new Map())
  })

  test('is empty when the file is missing or damaged', async () => {
    expect(await readAccessTokenCache(path, 'api-token')).toEqual(new Map())

    await writeAccessTokenCache(path, 'api-token', new Map())
    const contents = await readFile(path)
    contents[contents.length - 1] ^= 1
    await writeFile(path, contents)
    expect(await readAccessTokenCache(path, 'api-token')).toEqual(new Map())

    await writeFile(path, 'short')
    expect(await readAccessTokenCache(path, 'api-token')).toEqual(new Map())
  })
})
