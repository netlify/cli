/**
 * Keywords in both Javascript and TypeScript
 */
const reservedKewords = new Set([
  'abstract',
  'any',
  'as',
  'async',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'declare',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'get',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'is',
  'let',
  'module',
  'namespace',
  'new',
  'null',
  'number',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'require',
  'return',
  'set',
  'static',
  'string',
  'super',
  'switch',
  'symbol',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
])

const isReservedKeyword = (keyword) => reservedKewords.has(keyword)

const munge = (name) => {
  if (isReservedKeyword(name)) {
    return `_${name}`
  }
  return name
}

module.exports = {
  munge,
}
