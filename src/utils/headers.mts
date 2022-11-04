// TODO: use static `import` after migrating this repository to pure ES modules
const netlifyHeadersParser = import('netlify-headers-parser')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'headersFor... Remove this comment to see the full error message
const headersForPath = function (headers: $TSFixMe, path: $TSFixMe) {
  const matchingHeaders = headers.filter(({
    forRegExp
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => forRegExp.test(path)).map(getHeaderValues)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}

const getHeaderValues = function ({
  values
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  return values
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'parseHeade... Remove this comment to see the full error message
const parseHeaders = async function ({
  configPath,
  headersFiles
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  const { parseAllHeaders } = await netlifyHeadersParser
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
  })
  handleHeadersErrors(errors)
  return headers
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const handleHeadersErrors = function (errors: $TSFixMe) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(getErrorMessage).join('\n\n')
  log(NETLIFYDEVERR, `Headers syntax errors:\n${errorMessage}`)
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getErrorMe... Remove this comment to see the full error message
const getErrorMessage = function ({
  message
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  return message
}

module.exports = {
  headersForPath,
  parseHeaders,
}
