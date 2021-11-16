/**
 * Find all nodes from the AST in the subtree of node of SyntaxKind kind or satisfied by a type guard.
 * @param {import('typescript').Node} node
 * @param {import('typescript').SyntaxKind|(node:import('typescript').Node) => any} kindOrGuard
 * @param {number} max
 * @param {boolean} recursive
 * @returns {import('typescript').Node[]}
 */
module.exports = function findNodes(node, kindOrGuard, max = Number.POSITIVE_INFINITY, recursive = false) {
  if (!node || max === 0) {
    return []
  }

  const test = typeof kindOrGuard === 'function' ? kindOrGuard : (node) => node.kind === kindOrGuard
  const arr = []
  if (test(node)) {
    arr.push(node)
    max -= 1
  }
  if (max > 0 && (recursive || !test(node))) {
    // eslint-disable-next-line fp/no-loops
    for (const child of node.getChildren()) {
      // eslint-disable-next-line fp/no-loops
      for (const subNode of findNodes(child, test, max, recursive)) {
        if (max > 0) {
          arr.push(subNode)
        }
        max -= 1
      }
      if (max <= 0) {
        break
      }
    }
  }
  return arr
}
