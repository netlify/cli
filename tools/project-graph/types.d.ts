import type { Node } from 'typescript';

export type Dependency = {
  fileName: string;
  dependencies: Dependency[]
}

export type VisitorState = {
  fileName: string,
  dependencies: Dependency[]
}

export type visitorPlugin = (node: Node, state: VisitorState) => void
