 
import { digraph } from 'graphviz'

export class DependencyGraph {
  /** @type {Map<string, Set<string>>} */
  graph = new Map()

  hasFile(fileName) {
    return this.graph.has(fileName)
  }

  /**
   * Adds a node to the graph
   * @param {string} fileName
   * @returns {void}
   */
  addFile(fileName) {
    if (!this.graph.has(fileName)) {
      this.graph.set(fileName, new Set())
    }
  }

  addDependency(parent, child) {
    if (!this.graph.has(parent)) {
      this.addFile(parent)
    }
    if (!this.graph.has(child)) {
      this.addFile(child)
    }

    this.graph.set(parent, this.graph.get(parent).add(child))
  }

  /**
   * Provide a list of all affected files inside the graph based on the provided files
   * @param {string[]} files
   * @param {(file:string) => boolean} filterFunction
   * @returns {Set<string>}
   */
  affected(files, filterFunction) {
    const affectedFiles = new Set()

    const findParents = (leaf) => {
      if (((filterFunction && filterFunction(leaf)) || !filterFunction) && this.graph.has(leaf)) {
        affectedFiles.add(leaf)
      }

      this.graph.forEach((value, key) => {
        if (value.has(leaf)) {
          if ((filterFunction && filterFunction(leaf)) || !filterFunction) {
            affectedFiles.add(key)
          }
          findParents(key)
        }
      })
    }

    files.forEach((file) => {
      findParents(file)
    })

    return affectedFiles
  }

  /**
   * Visualizes a dependency graph the output is a graphviz graph
   * that can be printed to `.to_dot()` or rendered to a png file
   * @returns {import('graphviz').Graph}
   */
  visualize() {
    const graph = digraph('G')
    this.graph.forEach((edges, node) => {
      graph.addNode(node)
      edges.forEach((edge) => {
        graph.addEdge(node, edge)
      })
    })

    return graph
  }
}
