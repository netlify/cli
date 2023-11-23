import type { Node } from 'typescript'

import type { DependencyGraph } from './dependency-graph.js'

export type Dependency = {
  fileName: string
  /** A list of imported identifiers from this dependency */
  identifiers: string[]
  type: 'direct' | 'indirect'
  dependencies: Dependency[]
}

export type visitorPlugin = (node: Node) => string | undefined

export type VisitorState = {
  graph: DependencyGraph
  visitorPlugins: visitorPlugin[]
}
