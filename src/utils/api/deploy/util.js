const path = require('path')

exports.normalizePath = relname => {
  return (
    relname
      .split(path.sep)
      // .map(segment => encodeURIComponent(segment)) // TODO Messes up for paths with @ in them
      .join('/')
  )
}
