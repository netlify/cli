import { promises as fs } from 'node:fs'
import path from 'node:path'

import { type Node, type ParseError, findNodeAtLocation, parse, parseTree } from 'jsonc-parser'
import toml from 'toml'
import writeFileAtomic from 'write-file-atomic'

import { fileExistsAsync } from '../../lib/fs.js'

export type ConfigFormat = 'json' | 'toml'

export interface ProjectConfigFile {
  path: string
  alternatives?: string[]
  format: ConfigFormat
  key: string
  entry: Record<string, string | boolean>
  note?: string
}

export interface ConfigServer {
  name: string
  target: string
  disabled: boolean
}

export type ConfigRead =
  | { readable: true; path: string; content: string; servers: ConfigServer[] }
  | { readable: false; path: string; reason: string }

type ServerMap = Record<string, unknown>

const SERVER_FIELDS = new Set(['url', 'httpUrl', 'serverUrl', 'command'])

const isObject = (value: unknown): value is ServerMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const looksLikeServer = (value: unknown): boolean =>
  isObject(value) && Object.keys(value).some((field) => SERVER_FIELDS.has(field))

const stringLeaves = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value]
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringLeaves)
  }
  if (isObject(value)) {
    return Object.values(value).flatMap(stringLeaves)
  }
  return []
}

const serversIn = (map: unknown): ConfigServer[] =>
  isObject(map)
    ? Object.entries(map).map(([name, value]) => ({
        name,
        target: stringLeaves(value).join(' '),
        disabled: isObject(value) && (value.enabled === false || value.disabled === true),
      }))
    : []

const readFileOrEmpty = async (file: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }
    return undefined
  }
}

const detectEol = (content: string): string => (content.includes('\r\n') ? '\r\n' : '\n')

const detectIndent = (content: string): string => /^([ \t]+)"/m.exec(content)?.[1] ?? '  '

const parseJson = (content: string): ServerMap | undefined => {
  const errors: ParseError[] = []
  const parsed: unknown = parse(content, errors, { allowTrailingComma: true })
  return errors.length === 0 && isObject(parsed) ? parsed : undefined
}

const readJson = (file: string, content: string, key: string): ConfigRead => {
  if (content.trim() === '') {
    return { readable: true, path: file, content, servers: [] }
  }
  const parsed = parseJson(content)
  if (parsed === undefined) {
    return { readable: false, path: file, reason: 'it is not valid JSON' }
  }
  const bare = !(key in parsed) && Object.values(parsed).some(looksLikeServer)
  if (bare) {
    return { readable: false, path: file, reason: `its servers are not under ${JSON.stringify(key)}` }
  }
  if (key in parsed && !isObject(parsed[key])) {
    return { readable: false, path: file, reason: `its ${JSON.stringify(key)} is not an object` }
  }
  return { readable: true, path: file, content, servers: serversIn(parsed[key]) }
}

const parseToml = (content: string): ServerMap | undefined => {
  try {
    const parsed: unknown = toml.parse(content)
    return isObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const readToml = (file: string, content: string, key: string): ConfigRead => {
  const parsed = parseToml(content)
  if (parsed === undefined) {
    return { readable: false, path: file, reason: 'it is not valid TOML' }
  }
  return { readable: true, path: file, content, servers: serversIn(parsed[key]) }
}

const existingCandidates = async (workingDir: string, file: ProjectConfigFile): Promise<string[]> => {
  const present: string[] = []
  for (const candidate of [file.path, ...(file.alternatives ?? [])]) {
    if (await fileExistsAsync(path.join(workingDir, candidate))) {
      present.push(candidate)
    }
  }
  return present
}

const realpathOrSelf = async (target: string): Promise<string> => {
  try {
    return await fs.realpath(target)
  } catch {
    return target
  }
}

const realpathThroughMissing = async (target: string): Promise<string> => {
  const missing: string[] = []
  let existing = target
  while (!(await fileExistsAsync(existing))) {
    const parent = path.dirname(existing)
    if (parent === existing) {
      break
    }
    missing.unshift(path.basename(existing))
    existing = parent
  }
  return path.join(await realpathOrSelf(existing), ...missing)
}

const insideProject = async (workingDir: string, file: string): Promise<boolean> => {
  const root = await realpathOrSelf(workingDir)
  const resolved = await realpathThroughMissing(path.join(workingDir, file))
  return resolved.startsWith(`${root}${path.sep}`)
}

const readOne = (file: ProjectConfigFile, resolved: string, content: string): ConfigRead =>
  file.format === 'toml' ? readToml(resolved, content, file.key) : readJson(resolved, content, file.key)

export const readProjectConfig = async (workingDir: string, file: ProjectConfigFile): Promise<ConfigRead> => {
  const present = await existingCandidates(workingDir, file)
  const target = present[0] ?? file.path
  if (!(await insideProject(workingDir, target))) {
    return { readable: false, path: target, reason: 'it points outside this project' }
  }
  const servers: ConfigServer[] = []
  let first: string | undefined
  for (const candidate of present.length > 0 ? present : [target]) {
    const content = await readFileOrEmpty(path.join(workingDir, candidate))
    if (content === undefined) {
      return { readable: false, path: candidate, reason: 'it could not be read' }
    }
    const read = readOne(file, candidate, content)
    if (!read.readable) {
      return read
    }
    servers.push(...read.servers)
    first ??= read.content
  }
  return { readable: true, path: target, content: first ?? '', servers }
}

const tomlValue = (value: string | boolean): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value)

const objectDepth = (node: Node): number => {
  let depth = 0
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === 'object') {
      depth += 1
    }
  }
  return depth
}

const insertProperty = (
  content: string,
  object: Node,
  name: string,
  value: unknown,
  eol: string,
  indent: string,
): string | undefined => {
  const depth = objectDepth(object) + 1
  const last = object.children?.at(-1)
  const siblingPad = last === undefined ? undefined : /(?:^|\n|\r)([ \t]*)$/.exec(content.slice(0, last.offset))?.[1]
  const pad = siblingPad ?? indent.repeat(depth)
  const closing = object.offset + object.length - 1
  const property = `${JSON.stringify(name)}: ${JSON.stringify(value, null, indent).split('\n').join(`${eol}${pad}`)}`
  if (last === undefined) {
    if (content.slice(object.offset + 1, closing).trim() !== '') {
      return undefined
    }
    return `${content.slice(0, object.offset + 1)}${eol}${pad}${property}${eol}${indent.repeat(depth - 1)}${content.slice(closing)}`
  }
  const lastEnd = last.offset + last.length
  const lineEnd = content.indexOf(eol, lastEnd)
  if (lineEnd === -1 || lineEnd > closing) {
    return `${content.slice(0, lastEnd)}, ${JSON.stringify(name)}: ${JSON.stringify(value)}${content.slice(lastEnd)}`
  }
  const trailingComma = /^\s*,/.test(content.slice(lastEnd, lineEnd))
  const comma = trailingComma ? '' : ','
  return `${content.slice(0, lastEnd)}${comma}${content.slice(lastEnd, lineEnd)}${eol}${pad}${property}${trailingComma ? ',' : ''}${content.slice(lineEnd)}`
}

const withJsonEntry = (content: string, { key, entry }: ProjectConfigFile, name: string): string | undefined => {
  if (content.trim() === '') {
    return `${JSON.stringify({ [key]: { [name]: entry } }, null, 2)}\n`
  }
  const root = parseTree(content, [], { allowTrailingComma: true })
  if (root?.type !== 'object') {
    return undefined
  }
  const eol = detectEol(content)
  const indent = detectIndent(content)
  const servers = findNodeAtLocation(root, [key])
  return servers === undefined
    ? insertProperty(content, root, key, { [name]: entry }, eol, indent)
    : insertProperty(content, servers, name, entry, eol, indent)
}

const withTomlEntry = (content: string, { key, entry }: ProjectConfigFile, name: string): string => {
  const eol = detectEol(content)
  const lines = Object.entries(entry).map(([field, value]) => `${field} = ${tomlValue(value)}`)
  const table = [`[${key}.${name}]`, ...lines].join(eol)
  const separator = content === '' ? '' : content.endsWith(eol) ? eol : `${eol}${eol}`
  return `${content}${separator}${table}${eol}`
}

const holdsEntry = (content: string, { format, key }: ProjectConfigFile, name: string): boolean => {
  const parsed = format === 'toml' ? parseToml(content) : parseJson(content)
  return isObject(parsed?.[key]) && name in parsed[key]
}

export const addToProjectConfig = async (
  workingDir: string,
  file: ProjectConfigFile,
  name: string,
  { path: resolved, content }: { path: string; content: string },
): Promise<boolean> => {
  const updated = file.format === 'toml' ? withTomlEntry(content, file, name) : withJsonEntry(content, file, name)
  if (updated === undefined || !holdsEntry(updated, file, name)) {
    return false
  }
  const target = path.join(workingDir, resolved)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await writeFileAtomic(target, updated, 'utf8')
  return true
}
