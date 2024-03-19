import path from 'path'

import chokidar from 'chokidar'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'cook... Remove this comment to see the full error message
import cookie from 'cookie'
import redirector from 'netlify-redirector'
import type { Match, RedirectMatcher } from 'netlify-redirector'
import pFilter from 'p-filter'

import { fileExistsAsync } from '../lib/fs.js'

import { NETLIFYDEVLOG } from './command-helpers.js'
import { parseRedirects } from './redirects.js'
import { Request, Rewriter } from './types.js'

// @ts-expect-error TS(7034) FIXME: Variable 'watchers' implicitly has type 'any[]' in... Remove this comment to see the full error message
const watchers = []

// @ts-expect-error TS(7006) FIXME: Parameter 'files' implicitly has an 'any' type.
export const onChanges = function (files, listener) {
  // @ts-expect-error TS(7006) FIXME: Parameter 'file' implicitly has an 'any' type.
  files.forEach((file) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
    watchers.push(watcher)
  })
}

export const getWatchers = function () {
  // @ts-expect-error TS(7005) FIXME: Variable 'watchers' implicitly has an 'any[]' type... Remove this comment to see the full error message
  return watchers
}

// @ts-expect-error TS(7006) FIXME: Parameter 'headers' implicitly has an 'any' type.
export const getLanguage = function (headers) {
  if (headers['accept-language']) {
    return headers['accept-language'].split(',')[0].slice(0, 2)
  }
  return 'en'
}

export const createRewriter = async function ({
  // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'an... Remove this comment to see the full error message
  config,
  // @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
  configPath,
  // @ts-expect-error TS(7031) FIXME: Binding element 'distDir' implicitly has an 'any' ... Remove this comment to see the full error message
  distDir,
  // @ts-expect-error TS(7031) FIXME: Binding element 'geoCountry' implicitly has an 'an... Remove this comment to see the full error message
  geoCountry,
  // @ts-expect-error TS(7031) FIXME: Binding element 'jwtRoleClaim' implicitly has an '... Remove this comment to see the full error message
  jwtRoleClaim,
  // @ts-expect-error TS(7031) FIXME: Binding element 'jwtSecret' implicitly has an 'any... Remove this comment to see the full error message
  jwtSecret,
  // @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
  projectDir,
}): Promise<Rewriter> {
  let matcher: RedirectMatcher | null = null
  const redirectsFiles = [...new Set([path.resolve(distDir, '_redirects'), path.resolve(projectDir, '_redirects')])]
  let redirects = await parseRedirects({ config, redirectsFiles, configPath })

  const watchedRedirectFiles = configPath === undefined ? redirectsFiles : [...redirectsFiles, configPath]
  onChanges(watchedRedirectFiles, async () => {
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

  // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
  return async function rewriter(req: Request): Promise<Match | null> {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(
      req.url ?? '',
      `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
        req.hostname || req.headers.host
      }`,
    )
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
