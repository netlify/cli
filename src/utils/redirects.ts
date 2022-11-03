// @ts-check
// TODO: use static `import` after migrating this repository to pure ES modules
const netlifyRedirectParser = import('netlify-redirect-parser')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, log } = require('./command-helpers.cjs')

// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'parseRedir... Remove this comment to see the full error message
const parseRedirects = async function ({
  configPath,
  redirectsFiles
}: any) {
  const { parseAllRedirects } = await netlifyRedirectParser
  const { errors, redirects } = await parseAllRedirects({
    redirectsFiles,
    netlifyConfigPath: configPath,
    minimal: false,
  })
  handleRedirectParsingErrors(errors)
  return redirects.map(normalizeRedirect)
}

const handleRedirectParsingErrors = function (errors: any) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Redirects syntax errors:\n${errorMessage}`)
}

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getErrorMe... Remove this comment to see the full error message
const getErrorMessage = function ({
  message
}: any) {
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
  ...redirect
}: any) {
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
  }
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { parseRedirects }
