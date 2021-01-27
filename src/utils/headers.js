const fs = require('fs')

const { get } = require('dot-prop')

const TOKEN_COMMENT = '#'
const TOKEN_PATH = '/'

/**
 * @param {Object!} rule
 * The pattern to test.
 *
 * @param {string!} path
 * The target path to match against.
 *
 * @returns {boolean}
 * Whether or not the `rulePath` matches the `path`.
 */
const matchPaths = function (rule, path) {
  /**
   * Break the rule and target paths into pieces.
   *
   * /a/b/c -> ['a', 'b', 'c']
   */
  const ruleParts = rule.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  /**
   * Fast path for /*.
   */
  const matchAll = ruleParts.length === 1 && ruleParts[0] === '*'
  if (matchAll && path) return true
  /**
   * If either set of path parts is empty (indicating root dir /), they must
   * both be empty (/ and /), otherwise there is no match.
   */
  const noRuleParts = ruleParts.length === 0
  const noPathParts = pathParts.length === 0
  if (noRuleParts || noPathParts) return noRuleParts && noPathParts
  /**
   * Otherwise, iterate over ruleParts and pathParts.
   */
  for (let index = 0; index < ruleParts.length; index++) {
    /**
     * Select the corresponding pathPart and rulePart.
     */
    const rulePart = ruleParts[index]
    const pathPart = pathParts[index]
    /**
     * Whether or not all ruleParts and pathParts have been iterated over.
     */
    const noMoreRuleParts = index >= ruleParts.length - 1
    const noMorePathParts = index >= pathParts.length - 1
    /**
     * What kind of placeholder, if any, the current rulePart is.
     */
    const ruleIsAsterisk = rulePart === '*'
    const ruleIsPlaceholder = rulePart.startsWith(':')
    const ruleIsWildcard = ruleIsAsterisk || ruleIsPlaceholder
    /**
     * For either either wildcard - (*) or (:placeholder) - the entire path is a
     * definite match on this wildcard token if:
     */
    if (ruleIsWildcard) {
      /**
       * 1. the rulePart is a (*) wildcard AND it is the final rulePart, e.g.
       *    `/path/to/*` matched against `/path/to/multiple/subdirs`.
       */
      if (noMoreRuleParts && ruleIsAsterisk) return true
      /**
       * 2. all ruleParts and pathParts have been iterated over, e.g.
       *    `/path/to/:placeholder` and `/path/to/*` matched against
       *    `/path/to/something`, as well as `/static/*` and
       *    `/static/:placeholder` matched against `/static`)
       */
      if (noMorePathParts && noMoreRuleParts) return true
    } else if (rulePart !== pathPart) {
      /**
       * If a mismatch is found, the rule does not match.
       */
      return false
    } else if (noMoreRuleParts) {
      /**
       * If we have made it through all of the rules without finding a mismatch,
       * the rule matches the path.
       */
      return true
    }
  }
  /**
   * If no mismatch was found, the rule matches the target path.
   */
  return false
}

/**
 * Get the matching headers for `path` given a set of `rules`.
 *
 * @param {Object<string,string[]>!} rules
 * The rules to use for matching.
 *
 * @param {string!} path
 * The path to match against.
 *
 * @returns {Object<string,string[]>}
 */
const objectForPath = function (rules, path) {
  /**
   * Iterate over the rules and assign the matching headers.
   */
  const pathObject = {}
  for (const [rule, headers] of Object.entries(rules)) {
    /**
     * If the rule matches the math, assign the respective headers.
     */
    const isMatch = matchPaths(rule, path)
    if (isMatch) Object.assign(pathObject, headers)
  }
  /** Return matched headers. */
  return pathObject
}

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

    if (line.includes(':')) {
      const [key = '', value = ''] = line.split(':', 2)
      const trimmedKey = key.trim()
      const trimmedValue = value.trim()
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
  matchPaths,
  objectForPath,
  parseHeadersFile,
}
