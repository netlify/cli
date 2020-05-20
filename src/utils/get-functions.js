const fs = require('fs')
const path = require('path')
const { findModuleDir, findHandler } = require('./finders')

module.exports = {
  getFunctions(dir) {
    const functions = {}
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        if (dir === 'node_modules') {
          return
        }
        const functionPath = path.resolve(path.join(dir, file))
        const handlerPath = findHandler(functionPath)
        if (!handlerPath) {
          return
        }
        if (path.extname(functionPath) === '.js') {
          functions[file.replace(/\.js$/, '')] = {
            functionPath,
            moduleDir: findModuleDir(functionPath),
          }
        } else if (fs.lstatSync(functionPath).isDirectory()) {
          functions[file] = {
            functionPath: handlerPath,
            moduleDir: findModuleDir(functionPath),
          }
        }
      })
    }
    return functions
  },
}
