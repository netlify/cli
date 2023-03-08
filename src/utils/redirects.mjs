// @ts-check
import { parseAllRedirects } from 'netlify-redirect-parser'

import { NETLIFYDEVERR, log } from './command-helpers.mjs'

// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
export const parseRedirects = async function ({ configPath, redirectsFiles }) {
  const { errors, redirects } = await parseAllRedirects({
    redirectsFiles,
    netlifyConfigPath: configPath,
    minimal: false,
  })
  handleRedirectParsingErrors(errors)
  return redirects.map(normalizeRedirect)
}

const handleRedirectParsingErrors = function (errors) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Redirects syntax errors:\n${errorMessage}`)
}

const getErrorMessage = function ({ message }) {
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
}) {
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
