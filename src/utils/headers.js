const fs = require('fs')

const { get } = require('dot-prop')
const escapeRegExp = require('lodash/escapeRegExp')
const trimEnd = require('lodash/trimEnd')

const TOKEN_COMMENT = '#'
const TOKEN_PATH = '/'

// Our production logic uses regex too
const getRulePattern = (rule) => {
  const ruleParts = rule.split('/').filter(Boolean)
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
  const matchingHeaders = Object.entries(rules)
    .filter(([rule]) => matchesPath(rule, path))
    .map(([, headers]) => headers)

  const pathObject = Object.assign({}, ...matchingHeaders)
  return pathObject
}

const HEADER_SEPARATOR = ':'

const parseHeadersFile = function (filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  if (fs.statSync(filePath).isDirectory()) {
    console.warn('expected _headers file but found a directory at:', filePath)
    return {}
  }

  const lines = fs
    .readFileSync(filePath, { encoding: 'utf8' })
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index }))
    .filter(({ line }) => Boolean(line) && !line.startsWith(TOKEN_COMMENT))

  let path
  let rules = {}
  for (const { line, index } of lines) {
    if (line.startsWith(TOKEN_PATH)) {
      path = line
      continue
    }

    if (!path) {
      throw new Error('path should come before headers')
    }

    if (line.includes(HEADER_SEPARATOR)) {
      const [key = '', ...value] = line.split(HEADER_SEPARATOR)
      const [trimmedKey, trimmedValue] = [key.trim(), value.join(HEADER_SEPARATOR).trim()]
      if (trimmedKey.length === 0 || trimmedValue.length === 0) {
        throw new Error(`invalid header at line: ${index}\n${line}\n`)
      }

      const currentHeaders = get(rules, `${path}.${trimmedKey}`) || []
      rules = {
        ...rules,
        [path]: {
          ...rules[path],
          [trimmedKey]: [...currentHeaders, trimmedValue],
        },
      }
    }
  }

  return rules
}

module.exports = {
  matchesPath,
  headersForPath,
  parseHeadersFile,
}
