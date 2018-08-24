const snakeCase = require('lodash.snakecase')

exports.toEnvCase = key => {
  return `NETLIFY_${snakeCase(key).toUpperCase()}`
}

exports.isDotProp = key => {
  return key.includes('.') || key.includes('[')
}
