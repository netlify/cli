const path = require('path')

exports.normalizePath = relname => {
  return relname
    .split(path.sep)
    .map(segment => {
      return encodeURIComponent(segment)
    })
    .join('/')
}
