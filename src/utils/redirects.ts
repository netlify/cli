import { parseAllRedirects } from '@netlify/redirect-parser'

import { NETLIFYDEVERR, type NormalizedCachedConfigConfig, log } from './command-helpers.js'

interface ParsedRedirect {
  from: string
  query?: Record<string, string>
  signed?: string
  conditions: { country?: string[]; language?: string[]; role?: string[]; [key: string]: unknown }
  [key: string]: unknown
}

// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
export const parseRedirects = async function ({
  config,
  configPath,
  redirectsFiles,
}: {
  config?: Pick<NormalizedCachedConfigConfig, 'redirects'> | undefined
  configPath?: string | undefined
  redirectsFiles: string[]
}) {
  const { errors, redirects } = await parseAllRedirects({
    redirectsFiles,
    netlifyConfigPath: configPath,
    minimal: false,
    // @ts-expect-error FIXME(@netlify/redirect-parser): `configRedirects` is typed as `string[]` instead of redirect objects
    configRedirects: config?.redirects || [],
  })
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- FIXME(@netlify/redirect-parser): `errors` is typed as `any[]`
  handleRedirectParsingErrors(errors)
  // FIXME(@netlify/redirect-parser): `parseAllRedirects()` returns `unknown[]` instead of its normalized redirects
  return (redirects as ParsedRedirect[]).map(normalizeRedirect)
}

const handleRedirectParsingErrors = function (errors: Error[]) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Redirects syntax errors:\n${errorMessage}`)
}

const getErrorMessage = function ({ message }: Error) {
  return message
}

// `netlify-redirector` does not handle the same shape as the backend:
//  - `from` is called `origin`
//  - `query` is called `params`
//  - `conditions.role|country|language` are capitalized
const normalizeRedirect = function ({
  conditions: { country, language, role, ...conditions },
  from,
  query,
  signed,
  ...redirect
}: ParsedRedirect) {
  return {
    ...redirect,
    origin: from,
    params: query,
    conditions: {
      ...conditions,
      ...(role && { Role: role }),
      ...(country && { Country: country }),
      ...(language && { Language: language }),
    },
    ...(signed && {
      sign: {
        jwt_secret: signed,
      },
    }),
  }
}
