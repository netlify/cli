const escapeRegExp = require('lodash/escapeRegExp')
const trimEnd = require('lodash/trimEnd')
const { parseAllHeaders } = require('netlify-headers-parser')

const { NETLIFYDEVWARN } = require('./logo')

// Our production logic uses regex too
const getRulePattern = (forPath) => {
  const ruleParts = forPath.split('/').filter(Boolean)
  if (ruleParts.length === 0) {
    return `^/$`
  }

  let pattern = '^'

  ruleParts.forEach((part) => {
    if (part.startsWith(':')) {
      // :placeholder wildcard (e.g. /segment/:placeholder/test) - match everything up to a /
      pattern += '/([^/]+)/?'
    } else if (part === '*') {
      // standalone asterisk wildcard (e.g. /segment/*) - match everything
      if (pattern === '^') {
        pattern += '/?(.*)/?'
      } else {
        pattern = trimEnd(pattern, '/?')
        pattern += '(?:|/|/(.*)/?)'
      }
    } else if (part.includes('*')) {
      // non standalone asterisk wildcard (e.g. /segment/hello*world/test)
      pattern += `/${part.replace(/\*/g, '(.*)')}`
    } else if (part.trim() !== '') {
      // not a wildcard
      pattern += `/${escapeRegExp(part)}/?`
    }
  })

  pattern += '$'

  return pattern
}

const matchesPath = (rule, path) => {
  const pattern = getRulePattern(rule)
  return new RegExp(pattern, 'i').test(path)
}

/**
 * Get the matching headers for `path` given a set of `rules`.
 *
 * @param {Object<string,Object<string,string[]>>!} rules
 * The rules to use for matching.
 *
 * @param {string!} path
 * The path to match against.
 *
 * @returns {Object<string,string[]>}
 */
const headersForPath = function (rules, path) {
  const matchingHeaders = rules.filter(({ for: forPath }) => matchesPath(forPath, path)).map(getHeaderValues)
  const pathObject = Object.assign({}, ...matchingHeaders)
  return pathObject
}

const getHeaderValues = function ({ values }) {
  return values
}

const parseHeaders = async function ({ headersFiles }) {
  const { headers, errors } = await parseAllHeaders({ headersFiles })
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
  matchesPath,
  headersForPath,
  parseHeaders,
}
