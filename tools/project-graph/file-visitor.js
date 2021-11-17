// @ts-check
const { existsSync, readFileSync, statSync } = require('fs')
const { dirname, join, parse } = require('path')

const ts = require('typescript')

const { DependencyGraph } = require('./dependency-graph')

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
 * @param {import('./types').VisitorState} state
 * @param {any} parent
 */
const fileVisitor = function (fileName, state, parent) {
  if (!state) {
    state = { graph: new DependencyGraph(), visitorPlugins: [] }
  }

  if (state.graph.hasFile(fileName)) {
    // if the visitor was called with a parent we only need to add the dependency
    if (parent) {
      state.graph.addDependency(parent, fileName)
    }
    // no need to traverse the file again
    return
  }

  const folder = dirname(fileName)
  const fileContent = readFileSync(fileName, 'utf-8')
  const sourceFile = ts.createSourceFile(fileName, fileContent, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS)

  /**
   * Resolves a javascript import location
   * @param {string} importLocation
   * @returns {(string|null)}
   */
  const resolveLocation = function (importLocation) {
    const parsed = parse(importLocation)
    // absolute paths don't need to be resolved
    if (parsed.root) {
      return importLocation
    }
    if (importLocation.startsWith('.')) {
      return resolveRelativeModule(join(folder, importLocation))
    }
    // TODO: Ignored node_modules for now maybe add them later as they might be useful
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
        const resolvedImportLocation = resolveLocation(importLocation)
        // console.log(resolvedImportLocation)
        if (resolvedImportLocation) {
          fileVisitor(resolvedImportLocation, state, fileName)
        } else {
          console.error(`Could not resolve '${node.getFullText().trim()};' from: ${fileName}`)
        }
        // console.log()
        // console.log(resolvedImportLocation, state.graph.graph.get(resolvedImportLocation))
        // console.log(getVariableDeclarationIdentifiers(node.parent))
        // dependencies.push({
        //   fileName: resolvedImportLocation,
        //   identifiers: getVariableDeclarationIdentifiers(node.parent),
        //   // dependencies: parseDependencies(resolvedImportLocation, state),
        // })
      }
    }

    // go to the plugins
    state.visitorPlugins.forEach((plugin) => {
      const file = plugin(node)
      if (file) {
        fileVisitor(file, state, fileName)
      }
    })

    node.getChildren().forEach((childNode) => {
      ts.visitNode(childNode, visitor)
    })
  }
  // start visiting the sourceFile
  ts.visitNode(sourceFile, visitor)

  // add node to graph
  state.graph.addFile(fileName)

  if (parent) {
    state.graph.addDependency(parent, fileName)
  }
}

module.exports = { fileVisitor, resolveRelativeModule }
