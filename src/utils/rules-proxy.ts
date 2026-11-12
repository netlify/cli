import path from 'path'

import { createMatcher, type Matcher, type MatchResult } from '@netlify/redirect-matcher'
import chokidar, { type FSWatcher } from 'chokidar'
import { parseCookie } from 'cookie'
import pFilter from 'p-filter'

import { fileExistsAsync } from '../lib/fs.js'

import { NETLIFYDEVERR, NETLIFYDEVLOG, log, type NormalizedCachedConfigConfig } from './command-helpers.js'
import { parseRedirects } from './redirects.js'
import type { Request, Rewriter } from './types.js'

const watchers: FSWatcher[] = []

export const onChanges = function (files: string[], listener: () => unknown): void {
  files.forEach((file) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
    watchers.push(watcher)
  })
}

export const getWatchers = function (): FSWatcher[] {
  return watchers
}

export const getLanguage = function (headers: Record<string, string | string[] | undefined>) {
  if (headers['accept-language']) {
    return (
      Array.isArray(headers['accept-language']) ? headers['accept-language'].join(', ') : headers['accept-language']
    )
      .split(',')[0]
      .slice(0, 2)
  }
  return 'en'
}

export const createRewriter = async function ({
  config,
  configPath,
  distDir,
  geoCountry,
  jwtRoleClaim,
  jwtSecret,
  projectDir,
}: {
  config: NormalizedCachedConfigConfig
  configPath?: string | undefined
  distDir?: string | undefined
  geoCountry?: string | undefined
  jwtRoleClaim: string
  jwtSecret: string
  projectDir: string
}): Promise<Rewriter> {
  let matcher: Promise<Pick<Matcher, 'match'>> | null = null
  const redirectsFiles = [
    ...new Set([path.resolve(distDir ?? '', '_redirects'), path.resolve(projectDir, '_redirects')]),
  ]
  let redirects = await parseRedirects({ config, redirectsFiles, configPath })

  const watchedRedirectFiles = configPath === undefined ? redirectsFiles : [...redirectsFiles, configPath]
  onChanges(watchedRedirectFiles, async (): Promise<void> => {
    const existingRedirectsFiles = await pFilter(watchedRedirectFiles, fileExistsAsync)
    console.log(
      `${NETLIFYDEVLOG} Reloading redirect rules from`,
      existingRedirectsFiles.map((redirectFile) => path.relative(projectDir, redirectFile)),
    )
    redirects = await parseRedirects({ config, redirectsFiles, configPath })
    // Not closed: a request may still hold the previous matcher. The package
    // frees it once it is garbage-collected.
    matcher = null
  })

  const buildMatcher = async (): Promise<Pick<Matcher, 'match'>> => {
    // Without rules, skip compiling the matcher's WebAssembly module.
    if (redirects.length === 0) {
      return { match: () => null }
    }

    const built = await createMatcher(redirects, { jwtSecret, jwtRoleClaim })
    if (built.parseErrors.length !== 0) {
      log(NETLIFYDEVERR, `Redirects matcher errors:\n${built.parseErrors.map(({ message }) => message).join('\n\n')}`)
    }
    return built
  }

  // The promise is cached, not the matcher, so concurrent requests share one
  // build and a reload mid-build cannot cache a matcher of the old rules.
  const getMatcher = (): Promise<Pick<Matcher, 'match'>> => {
    if (!matcher) {
      const build = buildMatcher()
      matcher = build
      // A failed build is retried by the next request, unless a reload has
      // already replaced it with a newer one.
      build.catch(() => {
        if (matcher === build) matcher = null
      })
    }
    return matcher
  }

  return async function rewriter(req: Request): Promise<MatchResult | null> {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(
      req.url ?? '',
      `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
        req.hostname || req.headers.host
      }`,
    )
    const cookieValues = parseCookie(req.headers.cookie || '')
    const headers: Record<string, string | string[]> = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers),
      'x-country': cookieValues.nf_country || geoCountry || 'us',
      ...req.headers,
    }

    return matcherFunc.match({
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: decodeURIComponent(reqUrl.pathname),
      query: reqUrl.search.slice(1),
      headers,
      cookies: cookieValues,
    })
  }
}
