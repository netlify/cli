import { parseAllHeaders } from 'netlify-headers-parser'

import { NETLIFYDEVERR, log } from './command-helpers.mjs'

/**
 * Get the matching headers for `path` given a set of `rules`.
 *
 * @param {Object<string,Object<string,string[]>>!} headers
 * The rules to use for matching.
 *
 * @param {string!} path
 * The path to match against.
 *
 * @returns {Object<string,string[]>}
 */
export const headersForPath = function (headers, path) {
  const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(getHeaderValues)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}

const getHeaderValues = function ({ values }) {
  return values
}

export const parseHeaders = async function ({ configPath, headersFiles }) {
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
  })
  handleHeadersErrors(errors)
  return headers
}

const handleHeadersErrors = function (errors) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Headers syntax errors:\n${errorMessage}`)
}

const getErrorMessage = function ({ message }) {
  return message
}

export const NFRequestID = 'x-nf-request-id'
