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

  let handlerPath
  const indexHandlerPath = path.join(functionPath, `index.js`)
  const namedHandlerPath = path.join(functionPath, `${path.basename(functionPath)}.js`)

  if (fs.existsSync(namedHandlerPath)) {
    handlerPath = namedHandlerPath
  }
  if (fs.existsSync(indexHandlerPath) && !fs.existsSync(namedHandlerPath)) {
    handlerPath = indexHandlerPath
  }
  return handlerPath
}

module.exports = { findModuleDir, findHandler }
