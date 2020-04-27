const fs = require('fs')

const TOKEN_COMMENT = '#'
const TOKEN_PATH = '/'

function matchPaths(rulePath, targetPath) {
  const rulePathParts = rulePath.split('/').filter(Boolean)
  const targetPathParts = targetPath.split('/').filter(Boolean)

  if (rulePathParts.length < 1 && targetPathParts.length < 1) {
    return true
  }

  for (let i = 0; i < rulePathParts.length; i++) {
    if (i >= targetPathParts.length) return false

    const rulePart = rulePathParts[i]
    const target = targetPathParts[i]

    if (rulePart === '*') return true

    if (rulePart.startsWith(':')) {
      if (i === rulePathParts.length - 1) {
        return i === targetPathParts.length - 1
      }
      if (i === targetPathParts.length - 1) {
        return false
      }
    } else {
      return rulePart === target
    }
  }

  return false
}

function objectForPath(rules, pathname) {
  return Object.entries(rules).reduce(
    (prev, [rulePath, pathHeaders]) => Object.assign({}, prev, matchPaths(rulePath, pathname) && pathHeaders),
    {}
  )
}

function parseHeadersFile(filePath) {
  const rules = {}
  if (!fs.existsSync(filePath)) return rules
  if (fs.statSync(filePath).isDirectory()) {
    console.warn('expected _headers file but found a directory at:', filePath)
    return rules
  }

  const lines = fs.readFileSync(filePath, { encoding: 'utf8' }).split('\n')
  if (lines.length < 1) return rules

  let path
  for (let i = 0; i <= lines.length; i++) {
    if (!lines[i]) continue

    const line = lines[i].trim()

    if (line.startsWith(TOKEN_COMMENT) || line.length < 1) continue
    if (line.startsWith(TOKEN_PATH)) {
      if (line.includes('*') && line.indexOf('*') !== line.length - 1) {
        throw new Error(`invalid rule (A path rule cannot contain anything after * token) at line: ${i}\n${lines[i]}\n`)
      }
      path = line
      continue
    }

    if (!path) throw new Error('path should come before headers')

    if (line.includes(':')) {
      const sepIndex = line.indexOf(':')
      if (sepIndex < 1) throw new Error(`invalid header at line: ${i}\n${lines[i]}\n`)

      const key = line.substr(0, sepIndex).trim()
      const value = line.substr(sepIndex + 1).trim()

      if (rules.hasOwnProperty(path)) {
        if (rules[path].hasOwnProperty(key)) {
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
  parseHeadersFile
}
