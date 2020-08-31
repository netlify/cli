const path = require('path')
const fs = require('fs')
const alwaysIgnored = new Set(['aws-sdk'])

const ignoredExtensions = new Set([
  '.log',
  '.lock',
  '.html',
  '.md',
  '.map',
  '.ts',
  '.png',
  '.jpeg',
  '.jpg',
  '.gif',
  '.css',
  '.patch',
])

function ignoreMissing(dependency, optional) {
  return alwaysIgnored.has(dependency) || (optional && dependency in optional)
}

function includeModuleFile(packageJson, moduleFilePath) {
  if (packageJson.files) {
    return true
  }

  return !ignoredExtensions.has(path.extname(moduleFilePath))
}

function findModuleDir(dir) {
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

function findHandler(functionPath) {
  if (fs.lstatSync(functionPath).isFile()) {
    return functionPath
  }

  const handlerPath = path.join(functionPath, `${path.basename(functionPath)}.js`)
  if (!fs.existsSync(handlerPath)) {
    return
  }
  return handlerPath
}

module.exports = { findModuleDir, findHandler }
