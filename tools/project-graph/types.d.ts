import type { Node } from 'typescript';

export type Dependency = {
  fileName: string;
  /** A list of imported identifiers from this dependency */
  identifiers: string[];
  type: 'direct' | 'indirect';
  dependencies: Dependency[]
}

export type VisitorState = {
  fileName: string,
  dependencies: Dependency[],
  // program: Program
}

export type visitorPlugin = (node: Node, state: VisitorState) => void
