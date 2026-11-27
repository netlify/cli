import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'

import { getPathInCache } from '../../lib/settings.js'

const KEY_LABEL = 'netlify-curl-access-tokens-v1'
const NONCE_BYTES = 12
const TAG_BYTES = 16

// A cached token is reused only while it has at least this long left, to allow for clock skew and slow requests.
const MIN_REMAINING_SECONDS = 5 * 60

export interface CachedAccessToken {
  token: string
  expiresAt: number
}

export type AccessTokenCache = Map<string, CachedAccessToken>

export const getDefaultAccessTokenCachePath = () => getPathInCache(['curl', 'access-tokens'])

const deriveKey = (apiToken: string) => Buffer.from(hkdfSync('sha256', apiToken, '', KEY_LABEL, 32))

/**
 * Returns the `exp` claim of a JWT, in seconds since the epoch, without verifying the token.
 */
export const getTokenExpiry = (token: string): number | undefined => {
  const payload = token.split('.')[1]
  if (!payload) {
    return
  }

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown }
    return typeof exp === 'number' ? exp : undefined
  } catch {
    return
  }
}

/**
 * Returns the cached token for `host` if it has enough time left to be used.
 */
export const getUsableToken = (cache: AccessTokenCache, host: string, now = Date.now() / 1000): string | undefined => {
  const entry = cache.get(host)
  if (entry && entry.expiresAt - now >= MIN_REMAINING_SECONDS) {
    return entry.token
  }
}

/**
 * Reads the cache at `path`, which is encrypted with a key derived from `apiToken`.
 */
export const readAccessTokenCache = async (path: string, apiToken: string): Promise<AccessTokenCache> => {
  try {
    const data = await readFile(path)
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(apiToken), data.subarray(0, NONCE_BYTES))
    decipher.setAuthTag(data.subarray(data.length - TAG_BYTES))
    const plaintext = Buffer.concat([
      decipher.update(data.subarray(NONCE_BYTES, data.length - TAG_BYTES)),
      decipher.final(),
    ])
    const entries = JSON.parse(plaintext.toString('utf8')) as Record<string, CachedAccessToken>

    return new Map(Object.entries(entries))
  } catch {
    // The file is missing or damaged, or was written with a different API token.
    return new Map()
  }
}

/**
 * Encrypts the cache with a key derived from `apiToken` and writes it to `path`.
 */
export const writeAccessTokenCache = async (
  path: string,
  apiToken: string,
  cache: AccessTokenCache,
  now = Date.now() / 1000,
): Promise<void> => {
  const entries = Object.fromEntries([...cache].filter(([, { expiresAt }]) => expiresAt > now))
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(apiToken), nonce)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(entries), 'utf8'), cipher.final()])

  await mkdir(dirname(path), { recursive: true, mode: 0o700 })

  // The file is replaced in one step, so a concurrent reader sees either the old cache or the new one.
  const temporaryPath = `${path}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(temporaryPath, Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]), { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}
