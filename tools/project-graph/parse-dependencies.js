// @ts-check
const { existsSync, readFileSync, statSync } = require('fs')
const { dirname, join, parse } = require('path')

const ts = require('typescript')

/**
 * Get a list of imported identifiers, can be the default or a more from the destruction
 * @param {ts.Node} node
 * @returns {string[]} Returns the list of identifiers
 */
const getVariableDeclarationIdentifiers = (node) => {
  if (ts.isVariableDeclaration(node)) {
    if (ts.isIdentifier(node.name)) {
      return [node.name.text]
    }

    // variable destruction
    if (ts.isObjectBindingPattern(node.name)) {
      return node.name.elements.map((element) => ts.isIdentifier(element.name) && element.name.text).filter(Boolean)
    }
  }
}

/**
 * tries to resolve a relative javascript module based on its specifier
 * @param {string} moduleSpecifier
 * @returns {(string|null)}
 */
const resolveRelativeModule = (moduleSpecifier) => {
  if (existsSync(moduleSpecifier) && statSync(moduleSpecifier).isFile()) {
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
    if (importLocation.startsWith('.')) {
      return resolveRelativeModule(join(folder, importLocation))
    }
    // TODO: Ignored node_modules for now maybe add them later as they might be usefule
  }

  /**
   * Visits a typescript node
   * @type {ts.Visitor}
   */
  const visitor = function (node) {
    // TODO: once we need import specifiers (esm or typescript add them here)
    if (ts.isCallExpression(node) && node.expression.getText() === 'require' && ts.isStringLiteral(node.arguments[0])) {
      /** @type {string} */
      const importLocation = node.arguments[0].text
      if (importLocation.startsWith('.')) {
        const resolvedImportLocation = resolveImportLocation(importLocation)
        dependencies.push({
          fileName: resolvedImportLocation,
          identifiers: getVariableDeclarationIdentifiers(node.parent),
          dependencies: parseDependencies(resolvedImportLocation, visitorPlugins),
        })
      }
    }

    node.getChildren().forEach((childNode) => {
      ts.visitNode(childNode, visitor)
    })

    // getting always called after the leaf was inspected from bottom to top
    visitorPlugins.forEach((plugin) => {
      plugin(node, { fileName, dependencies })
    })
  }
  // start visiting the sourceFile
  ts.visitNode(sourceFile, visitor)

  return dependencies
}

module.exports = { parseDependencies, resolveRelativeModule }
