import { spawn, type ChildProcess } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { isIP } from 'net'
import { constants, tmpdir } from 'os'
import { join } from 'path'
import process from 'process'

import type { NetlifyAPI } from '@netlify/api'
import type { OptionValues } from 'commander'

import { BANG, chalk } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

import {
  getDefaultAccessTokenCachePath,
  getTokenExpiry,
  getUsableToken,
  readAccessTokenCache,
  writeAccessTokenCache,
} from './access-token-cache.js'

const MINT_TIMEOUT_MS = 10_000

const FORWARDED_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP']

// Name of the cookie that holds the team login access token.
const ACCESS_COOKIE_NAME = 'nf_edge'

/**
 * Returns the hostnames of the http and https URLs in a list of curl arguments.
 */
export const getTargetHosts = (args: string[]): string[] => {
  const hosts = new Set<string>()

  for (const arg of args) {
    const value = arg.startsWith('--url=') ? arg.slice('--url='.length) : arg

    // This also matches values of other options, like `--referer`, which is harmless because a cookie is only sent to
    // its own host.
    if (!/^https?:\/\//i.test(value)) {
      continue
    }

    let url: URL
    try {
      url = new URL(value)
    } catch {
      continue
    }

    const { hostname } = url

    // IP addresses and single-label hosts like `localhost` can't be Netlify projects.
    if (!hostname.includes('.') || isIP(hostname.replace(/^\[|\]$/g, '')) !== 0) {
      continue
    }

    hosts.add(hostname)
  }

  return [...hosts]
}

/**
 * Formats access tokens as a cookie jar.
 */
export const formatCookieJar = (tokens: Map<string, string>): string =>
  [...tokens]
    .map(([host, token]) =>
      [
        host,
        // Include subdomains: no, so the cookie is only sent to this exact host.
        'FALSE',
        // Path.
        '/',
        // Secure: yes, so curl only sends the cookie over HTTPS.
        'TRUE',
        // Expiry: 0 makes it a session cookie, which curl never drops on its own.
        '0',
        ACCESS_COOKIE_NAME,
        token,
      ].join('\t'),
    )
    .map((line) => `${line}\n`)
    .join('')

/**
 * Asks the Netlify API for a team login access token for `host`.
 */
export const mintAccessToken = async (
  api: NetlifyAPI,
  host: string,
): Promise<{ token: string } | { warning: string } | null> => {
  let response: Response
  try {
    response = await fetch(`${api.scheme}://${api.host}/auth/edge-access`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${api.accessToken ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_id: host, domain: host }),
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      warning: `Could not request access to ${host}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // The host isn't a Netlify project the user can access.
  if (response.status === 404) {
    return null
  }

  // The API answers 401 when the Netlify token is invalid, and when the team requires a SAML single sign-on or
  // two-factor login that this token didn't come from.
  if (response.status === 401) {
    const { message } = (await response.json().catch(() => ({}))) as { message?: unknown }
    const reason = typeof message === 'string' && message !== '' ? message.replace(/\.?$/, '.') : 'HTTP 401.'
    return {
      warning: `Netlify did not grant access to ${host}: ${reason} To log in again, run ${chalk.cyanBright(
        'netlify login --new',
      )}.`,
    }
  }

  if (!response.ok) {
    return { warning: `Could not request access to ${host} (HTTP ${response.status.toString()}).` }
  }

  const { edge_access: token } = (await response.json().catch(() => ({}))) as { edge_access?: unknown }
  if (typeof token !== 'string' || token === '') {
    return { warning: `Could not request access to ${host}: the response had no token.` }
  }

  return { token }
}

/**
 * Returns access tokens for the hosts the user can access, and warnings for requests that failed.
 */
export const getAccessTokens = async (
  api: NetlifyAPI,
  hosts: string[],
  cachePath = getDefaultAccessTokenCachePath(),
): Promise<{ tokens: Map<string, string>; warnings: string[] }> => {
  const apiToken = api.accessToken ?? ''
  const cache = await readAccessTokenCache(cachePath, apiToken)
  const results = await Promise.all(
    hosts.map(async (host) => {
      // Tokens from earlier runs are reused until shortly before they expire.
      const cachedToken = getUsableToken(cache, host)
      return [host, cachedToken === undefined ? await mintAccessToken(api, host) : { token: cachedToken }] as const
    }),
  )
  const tokens = new Map<string, string>()
  const warnings: string[] = []
  let cacheChanged = false

  for (const [host, result] of results) {
    if (result === null) {
      continue
    }
    if ('warning' in result) {
      warnings.push(result.warning)
      continue
    }

    tokens.set(host, result.token)

    // Newly requested tokens are added to the cache, unless they have no expiry.
    const expiresAt = getTokenExpiry(result.token)
    if (cache.get(host)?.token !== result.token && expiresAt !== undefined) {
      cache.set(host, { token: result.token, expiresAt })
      cacheChanged = true
    }
  }

  if (cacheChanged) {
    // The cache only saves API requests, so a failure to write it doesn't affect the command.
    await writeAccessTokenCache(cachePath, apiToken, cache).catch(() => undefined)
  }

  return { tokens, warnings }
}

/**
 * Runs curl, with `cookieJar` as an extra cookie source, and resolves with its exit code.
 */
export const runCurl = async (args: string[], cookieJar?: string): Promise<number> => {
  let child: ChildProcess | undefined
  let receivedSignal: NodeJS.Signals | undefined

  // Without a listener, Node exits at once on these signals, which would leave the temporary cookie jar behind. They're
  // passed on to curl while it runs, and stop it from starting if they arrive first.
  const onSignal = (signal: NodeJS.Signals) => {
    receivedSignal ??= signal
    child?.kill(signal)
  }
  for (const signal of FORWARDED_SIGNALS) {
    process.on(signal, onSignal)
  }

  const runChild = (curlArgs: string[]) => {
    if (receivedSignal) {
      return Promise.resolve(128 + constants.signals[receivedSignal])
    }
    child = spawn('curl', curlArgs, { stdio: 'inherit' })
    return waitForExit(child)
  }

  try {
    if (cookieJar === undefined) {
      return await runChild(args)
    }

    // curl only reads a cookie jar from a path, so the jar goes in a temporary file that only the user can read.
    const directory = await mkdtemp(join(tmpdir(), 'netlify-curl-'))
    try {
      const jarPath = join(directory, 'cookies.txt')
      await writeFile(jarPath, cookieJar, { mode: 0o600 })
      return await runChild(['--cookie', jarPath, ...args])
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  } finally {
    for (const signal of FORWARDED_SIGNALS) {
      process.off(signal, onSignal)
    }
  }
}

const waitForExit = (child: ChildProcess): Promise<number> =>
  new Promise((resolve, reject) => {
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(new Error('curl is not installed, or is not on your PATH.'))
        return
      }
      reject(error)
    })

    child.on('close', (code, signal) => {
      if (code !== null) {
        resolve(code)
        return
      }
      // Match the shell's exit code for a process killed by a signal.
      resolve(128 + (signal ? constants.signals[signal] : 0))
    })
  })

const warn = (message: string) => {
  process.stderr.write(` ${chalk.yellow(BANG)}   Warning: ${message}\n`)
}

export const curl = async (args: string[], options: OptionValues, command: BaseCommand) => {
  const { api } = command.netlify
  const silent = Boolean(options.silent)
  const { version, verbose } = command.parent?.opts() ?? {}

  // The CLI also defines `--silent`, `-v` and `--verbose`, so they never reach `args`. In curl, `-v` means `--verbose`.
  const curlArgs = [...(silent ? ['--silent'] : []), ...(version || verbose ? ['--verbose'] : []), ...args]
  const hosts = getTargetHosts(args)

  if (hosts.length === 0) {
    process.exitCode = await runCurl(curlArgs)
    return
  }

  if (!api.accessToken) {
    if (!silent) {
      warn(
        `You're not logged in to Netlify, so the request is sent without access to protected projects. Run ${chalk.cyanBright(
          'netlify login',
        )}, or ${chalk.cyanBright('netlify login --request "<message>"')} to ask a person to log in for you.`,
      )
    }
    process.exitCode = await runCurl(curlArgs)
    return
  }

  const { tokens, warnings } = await getAccessTokens(api, hosts)
  if (!silent) {
    warnings.forEach(warn)
  }

  process.exitCode = await runCurl(curlArgs, tokens.size === 0 ? undefined : formatCookieJar(tokens))
}
