import { promises as fs } from 'node:fs'
import path from 'node:path'

import toml from 'toml'
import writeFileAtomic from 'write-file-atomic'

export type ConfigFormat = 'json' | 'toml'

export interface ProjectConfigFile {
  path: string
  alternatives?: string[]
  format: ConfigFormat
  key: string
  entry: Record<string, string | boolean>
}

export interface ConfigServer {
  name: string
  target: string
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
  isObject(map) ? Object.entries(map).map(([name, value]) => ({ name, target: stringLeaves(value).join(' ') })) : []

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

const indentCandidates = (content: string): string[] => {
  const indented = /^([ \t]+)"/m.exec(content)?.[1]
  return indented === undefined ? ['  ', ''] : [indented]
}

const detectEol = (content: string): string => (content.includes('\r\n') ? '\r\n' : '\n')

const serializeJson = (value: unknown, like: string, indent: string): string => {
  const eol = detectEol(like)
  const trailing = like === '' || like.endsWith(eol) ? eol : ''
  return `${JSON.stringify(value, null, indent).replace(/\n/g, eol)}${trailing}`
}

const matchingIndent = (parsed: unknown, content: string): string | undefined =>
  content.trim() === ''
    ? '  '
    : indentCandidates(content).find((indent) => serializeJson(parsed, content, indent) === content)

const parseJson = (content: string): ServerMap | undefined => {
  try {
    const parsed: unknown = JSON.parse(content)
    return isObject(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const readJson = (file: string, content: string, key: string): ConfigRead => {
  if (content.trim() === '') {
    return { readable: true, path: file, content, servers: [] }
  }
  const parsed = parseJson(content)
  if (parsed === undefined) {
    return { readable: false, path: file, reason: 'it is not plain JSON' }
  }
  if (matchingIndent(parsed, content) === undefined) {
    return { readable: false, path: file, reason: 'it has formatting that would not be kept' }
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

const exists = async (target: string): Promise<boolean> => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const resolveConfigPath = async (workingDir: string, file: ProjectConfigFile): Promise<string> => {
  for (const candidate of [file.path, ...(file.alternatives ?? [])]) {
    if (await exists(path.join(workingDir, candidate))) {
      return candidate
    }
  }
  return file.path
}

export const readProjectConfig = async (workingDir: string, file: ProjectConfigFile): Promise<ConfigRead> => {
  const resolved = await resolveConfigPath(workingDir, file)
  const content = await readFileOrEmpty(path.join(workingDir, resolved))
  if (content === undefined) {
    return { readable: false, path: resolved, reason: 'it could not be read' }
  }
  return file.format === 'toml' ? readToml(resolved, content, file.key) : readJson(resolved, content, file.key)
}

const tomlValue = (value: string | boolean): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value)

const withJsonEntry = (content: string, { key, entry }: ProjectConfigFile, name: string): string | undefined => {
  const parsed = content.trim() === '' ? {} : (parseJson(content) ?? {})
  const indent = matchingIndent(parsed, content)
  if (indent === undefined) {
    return undefined
  }
  const servers = isObject(parsed[key]) ? parsed[key] : {}
  parsed[key] = { ...servers, [name]: entry }
  return serializeJson(parsed, content, indent)
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
