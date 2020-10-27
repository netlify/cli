const fs = require('fs')
const path = require('path')

const findModuleDir = function (dir) {
  let basedir = dir
  while (!fs.existsSync(path.join(basedir, 'package.json'))) {
    const newBasedir = path.dirname(basedir)
    if (newBasedir === basedir) {
      return null
    }
    basedir = newBasedir
  }
  return basedir
}

const findHandler = function (functionPath) {
  if (fs.lstatSync(functionPath).isFile()) {
    return functionPath
  }

  const namedHandlerPath = path.join(functionPath, `${path.basename(functionPath)}.js`)
  if (fs.existsSync(namedHandlerPath)) {
    return namedHandlerPath
  }

  const indexHandlerPath = path.join(functionPath, `index.js`)
  if (fs.existsSync(indexHandlerPath)) {
    return indexHandlerPath
  }
}

module.exports = { findModuleDir, findHandler }
