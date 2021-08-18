const { parseAllHeaders } = require('netlify-headers-parser')

const { NETLIFYDEVWARN } = require('./logo')

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
const headersForPath = function (headers, path) {
  const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(getHeaderValues)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}

const getHeaderValues = function ({ values }) {
  return values
}

const parseHeaders = async function ({ headersFiles }) {
  const { headers, errors } = await parseAllHeaders({ headersFiles, minimal: false })
  handleHeadersErrors(errors)
  return headers
}

const handleHeadersErrors = function (errors) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  throw new Error(`${NETLIFYDEVWARN} Warnings while parsing headers:

${errorMessage}`)
}

const getErrorMessage = function ({ message }) {
  return message
}

module.exports = {
  headersForPath,
  parseHeaders,
}
