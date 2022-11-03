// TODO: use static `import` after migrating this repository to pure ES modules
const netlifyHeadersParser = import('netlify-headers-parser')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, log } = require('./command-helpers.cjs')

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
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'headersFor... Remove this comment to see the full error message
const headersForPath = function (headers: any, path: any) {
  const matchingHeaders = headers.filter(({
    forRegExp
  }: any) => forRegExp.test(path)).map(getHeaderValues)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}

const getHeaderValues = function ({
  values
}: any) {
  return values
}

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'parseHeade... Remove this comment to see the full error message
const parseHeaders = async function ({
  configPath,
  headersFiles
}: any) {
  const { parseAllHeaders } = await netlifyHeadersParser
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
  })
  handleHeadersErrors(errors)
  return headers
}

const handleHeadersErrors = function (errors: any) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Headers syntax errors:\n${errorMessage}`)
}

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getErrorMe... Remove this comment to see the full error message
const getErrorMessage = function ({
  message
}: any) {
  return message
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
  headersForPath,
  parseHeaders,
}
