import path from 'path'

import chokidar, { type FSWatcher } from 'chokidar'
import cookie from 'cookie'
import redirector from 'netlify-redirector'
import type { Match, RedirectMatcher } from 'netlify-redirector'
import pFilter from 'p-filter'

import { fileExistsAsync } from '../lib/fs.js'

import { NETLIFYDEVLOG, type NormalizedCachedConfigConfig } from './command-helpers.js'
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
  let matcher: RedirectMatcher | null = null
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
    matcher = null
  })

  const getMatcher = async (): Promise<RedirectMatcher> => {
    if (matcher) return matcher

    if (redirects.length !== 0) {
      return (matcher = await redirector.parseJSON(JSON.stringify(redirects), {
        jwtSecret,
        jwtRoleClaim,
      }))
    }
    return {
      match() {
        return null
      },
    }
  }

  return async function rewriter(req: Request): Promise<Match | null> {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(req.url ?? '', `${req.protocol}://${req.hostname}`)
    const cookieValues = cookie.parse(req.headers.cookie || '')
    const headers: Record<string, string | string[]> = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers),
      'x-country': cookieValues.nf_country || geoCountry || 'us',
      ...req.headers,
    }

    // Definition: https://github.com/netlify/libredirect/blob/e81bbeeff9f7c260a5fb74cad296ccc67a92325b/node/src/redirects.cpp#L28-L60
    const matchReq = {
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: decodeURIComponent(reqUrl.pathname),
      query: reqUrl.search.slice(1),
      headers,
      cookieValues,
      getHeader: (name: string) => {
        const val = headers[name.toLowerCase()]
        if (Array.isArray(val)) {
          return val[0]
        }
        return val || ''
      },
      getCookie: (key: string) => cookieValues[key] || '',
    }
    const match = matcherFunc.match(matchReq)
    return match
  }
}
