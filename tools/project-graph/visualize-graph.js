const graphviz = require('graphviz')

/**
 * @param {import('./types').Dependency} dependency
 * @param {graphviz.Graph} graph
 */
const buildGraph = (dependency, graph, parentNode) => {
  const node = graph.addNode(dependency.fileName)

  if (parentNode) {
    const edge = graph.addEdge(parentNode, node)
    if (dependency.type === 'indirect') {
      edge.set('color', 'red')
    }
  }
  // const e = node.addEdge( n1, "World" );
  // e.set( "color", "red" );
  dependency.dependencies.forEach((child) => {
    // console.log(child)
    buildGraph(child, graph, node)
  })
}

/**
 * Creates a dot graph out of the dependencies
 * @param {string} fileName
 * @param {import('./types').Dependency[]} dependencies
 * @returns {string} Dot graph as string
 */
module.exports = (fileName, dependencies) => {
  const dependencyGraph = graphviz.digraph('G')

  buildGraph({ fileName, dependencies }, dependencyGraph)

  return `strict ${dependencyGraph.to_dot()}`
}
