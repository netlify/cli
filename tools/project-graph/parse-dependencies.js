// @ts-check
const { existsSync, readFileSync } = require('fs')
const { dirname, join, parse } = require('path')

const ts = require('typescript')

/**
 * tries to resolve a relative javascript module based on its specifier
 * @param {string} moduleSpecifier
 * @returns {(string|null)}
 */
const resolveRelativeModule = (moduleSpecifier) => {
  if (existsSync(moduleSpecifier)) {
    return moduleSpecifier
  }
  if (existsSync(`${moduleSpecifier}.js`)) {
    return `${moduleSpecifier}.js`
  }
  if (existsSync(`${moduleSpecifier}/index.js`)) {
    return `${moduleSpecifier}/index.js`
  }
  return null
}

/**
 * Parses the dependencies out of a file
 * @param {string} fileName
 * @param {import('./types').visitorPlugin[]} visitorPlugins
 */
const parseDependencies = function (fileName, visitorPlugins = []) {
  const folder = dirname(fileName)
  const fileContent = readFileSync(fileName, 'utf-8')
  const sourceFile = ts.createSourceFile(fileName, fileContent, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS)
  const dependencies = []

  /**
   * Resolves a javascript import location
   * @param {string} importLocation
   * @returns {(string|null)}
   */
  const resolveImportLocation = function (importLocation) {
    const parsed = parse(importLocation)
    // absolute paths don't need to be resolved
    if (parsed.root) {
      return importLocation
    }
    // the importLocation is a string and therefore a node_module
    if (parsed.base === parsed.name && parsed.dir === '' && parsed.root === '') {
      return require.resolve(importLocation)
    }
    return resolveRelativeModule(join(folder, importLocation))
  }

  /**
   * Visits a typescript node
   * @type {ts.Visitor}
   */
  const visitor = function (node) {
    // TODO: once we need import specifiers (esm or typescript add them here)
    if (ts.isCallExpression(node) && node.expression.getText() === 'require') {
      /** @type {string} */
      const importLocation = node.arguments[0].text
      if (importLocation.startsWith('.')) {
        const resolvedImportLocation = resolveImportLocation(importLocation)
        dependencies.push({
          filename: resolvedImportLocation,
          dependencies: parseDependencies(resolvedImportLocation),
        })
      }
    }

    node.getChildren().forEach((childNode) => {
      ts.visitNode(childNode, visitor)
    })

    // getting always called after the leaf was inspected from bottom to top
    visitorPlugins.forEach((plugin) => {
      plugin(node, { fileName, dependencies})
    })
  }
  // start visiting the sourceFile
  ts.visitNode(sourceFile, visitor)

  return dependencies
}

module.exports = { parseDependencies, resolveRelativeModule }
