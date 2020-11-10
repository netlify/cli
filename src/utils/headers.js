const fs = require('fs')

const TOKEN_COMMENT = '#'
const TOKEN_PATH = '/'

const matchPaths = function (rulePath, targetPath) {
  const rulePathParts = rulePath.split('/').filter(Boolean)
  const targetPathParts = targetPath.split('/').filter(Boolean)

  if (
    targetPathParts.length === 0 &&
    (rulePathParts.length === 0 || (rulePathParts.length === 1 && rulePathParts[0] === '*'))
  ) {
    return true
  }

  for (let index = 0; index < rulePathParts.length; index++) {
    if (index >= targetPathParts.length) return false

    const rulePart = rulePathParts[index]
    const target = targetPathParts[index]

    if (rulePart === '*') return true

    if (rulePart.startsWith(':')) {
      if (index === rulePathParts.length - 1) {
        return index === targetPathParts.length - 1
      }
      if (index === targetPathParts.length - 1) {
        return false
      }
    } else {
      return rulePart === target
    }
  }

  return false
}

const objectForPath = function (rules, pathname) {
  return Object.entries(rules).reduce(
    (prev, [rulePath, pathHeaders]) => ({ ...prev, ...(matchPaths(rulePath, pathname) && pathHeaders) }),
    {},
  )
}

const parseHeadersFile = function (filePath) {
  const rules = {}
  if (!fs.existsSync(filePath)) return rules
  if (fs.statSync(filePath).isDirectory()) {
    console.warn('expected _headers file but found a directory at:', filePath)
    return rules
  }

  const lines = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n')
  if (lines.length === 0) return rules

  let path
  for (let index = 0; index <= lines.length; index++) {
    if (!lines[index]) continue

    const line = lines[index].trim()

    if (line.startsWith(TOKEN_COMMENT) || line.length === 0) continue
    if (line.startsWith(TOKEN_PATH)) {
      if (line.includes('*') && line.indexOf('*') !== line.length - 1) {
        throw new Error(
          `invalid rule (A path rule cannot contain anything after * token) at line: ${index}\n${lines[index]}\n`,
        )
      }
      path = line
      continue
    }

    if (!path) throw new Error('path should come before headers')

    if (line.includes(':')) {
      const sepIndex = line.indexOf(':')
      if (sepIndex < 1) throw new Error(`invalid header at line: ${index}\n${lines[index]}\n`)

      const key = line.slice(0, sepIndex).trim()
      const value = line.slice(sepIndex + 1).trim()

      if (Object.prototype.hasOwnProperty.call(rules, path)) {
        if (Object.prototype.hasOwnProperty.call(rules[path], key)) {
          rules[path][key].push(value)
        } else {
          rules[path][key] = [value]
        }
      } else {
        rules[path] = { [key]: [value] }
      }
    }
  }

  return rules
}

module.exports = {
  objectForPath,
  parseHeadersFile,
}
