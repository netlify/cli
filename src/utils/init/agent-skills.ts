import { createHash, randomBytes } from 'node:crypto'
import { promises as fs, type Dirent } from 'node:fs'
import path from 'node:path'

import { getDrivingAgent } from '../agent-detection.js'
import { chalk, log, netlifyCommand, version, warn } from '../command-helpers.js'

export const DEFAULT_SKILLS_HOST = 'https://netlify-agent-skills.netlify.app'
export const SKILLS_HOST_ENV = 'NETLIFY_SKILLS_HOST'
export const DEFAULT_SKILLS_DIRECTORY = path.join('.agents', 'skills')

const AGENT_DIRECTORIES = ['.claude', '.agents', '.grok'] as const
const AGENT_DIRECTORY_BY_DRIVING_AGENT: Partial<Record<string, string>> = {
  claude: '.claude',
}

const SUPPORTED_SCHEMA_VERSION = 1
const SKILL_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/
const STAGING_PREFIX = '.netlify-skill-'
const STAGING_LEFTOVER = /^\.netlify-skill-(.+)-[A-Za-z0-9]{6}$/
const RETIRED_LEFTOVER = /^(.+)\.old-\d+-[0-9a-f]{12}$/
const FETCH_TIMEOUT_MS = 10_000
const LEFTOVER_MIN_AGE_MS = 10 * 60_000
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface SkillHistoryEntry {
  version: string | null
  name?: string
  tree_hash: string
}

export interface ManifestSkill {
  name: string
  status: 'active' | 'deprecated'
  version: string | null
  prior_names?: string[]
  description?: string
  tree_hash: string | null
  files?: Record<string, string>
  executable?: string[]
  history?: SkillHistoryEntry[]
  deprecated?: { since: string; replaced_by?: string }
}

export interface SkillsManifest {
  schema_version: number
  version: string
  skills: ManifestSkill[]
}

export type SkillRecord =
  | { name: string; status: 'current'; version: string | null }
  | { name: string; status: 'stale'; version: string | null; have: string | null }
  | { name: string; status: 'modified'; version: string | null }
  | { name: string; status: 'renamed'; currentName: string; modified: boolean }
  | { name: string; status: 'deprecated'; replacedBy: string | null; modified: boolean }
  | { name: string; status: 'unknown' }

export interface SkillsClassification {
  skills: SkillRecord[]
  missing: string[]
}

export type SkillAction =
  | 'current'
  | 'added'
  | 'updated'
  | 'reset'
  | 'renamed'
  | 'removed'
  | 'kept'
  | 'ignored'
  | 'failed'

export interface SkillActionRecord {
  name: string
  action: SkillAction
  detail?: string
}

export interface SkillsSyncResult {
  directory: string
  actions: SkillActionRecord[]
}

class SkillsError extends Error {}

class SkillConflictError extends SkillsError {}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return `the download timed out after ${String(FETCH_TIMEOUT_MS / 1000)}s`
  }
  if (error instanceof Error) {
    return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message
  }
  return String(error)
}

const sha256 = (bytes: Uint8Array): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`

export const resolveSkillsHost = (env: NodeJS.ProcessEnv = process.env): string => {
  const raw = env[SKILLS_HOST_ENV]
  if (!raw) {
    return DEFAULT_SKILLS_HOST
  }
  const url = new URL(raw)
  const loopback = LOOPBACK_HOSTS.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new SkillsError(`${SKILLS_HOST_ENV} must be https:// (http:// is accepted for localhost only): ${raw}`)
  }
  return url.toString().replace(/\/$/, '')
}

const urlFor = (host: string, ...parts: string[]): string =>
  `${host}/${parts.map((part) => encodeURIComponent(part)).join('/')}`

const fetchBytes = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url, {
    headers: { 'user-agent': `NetlifyCLI ${version}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'error',
  })
  if (!response.ok) {
    throw new SkillsError(`${url}: HTTP ${response.status.toString()}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

function assertSkillName(name: unknown, what: string): asserts name is string {
  if (typeof name !== 'string' || !SKILL_NAME.test(name)) {
    throw new SkillsError(`manifest: invalid ${what} ${JSON.stringify(name)}`)
  }
}

const isSafeFilePath = (file: string): boolean =>
  file.length > 0 &&
  !file.includes('\\') &&
  !path.posix.isAbsolute(file) &&
  file.split('/').every((part) => part && part !== '.' && part !== '..')

interface ManifestIndex {
  exact: Map<string, ManifestSkill>
  prior: Map<string, ManifestSkill>
}

const indexManifest = (manifest: SkillsManifest): ManifestIndex => {
  if (!Array.isArray(manifest.skills)) {
    throw new SkillsError('manifest has no skills array')
  }
  const exact = new Map<string, ManifestSkill>()
  const prior = new Map<string, ManifestSkill>()
  for (const skill of manifest.skills) {
    assertSkillName(skill.name, 'skill name')
    if (exact.has(skill.name)) {
      throw new SkillsError(`manifest: duplicate skill name ${JSON.stringify(skill.name)}`)
    }
    if (skill.status === 'active' && typeof skill.tree_hash !== 'string') {
      throw new SkillsError(`manifest: active skill ${skill.name} has no tree_hash`)
    }
    exact.set(skill.name, skill)
    for (const name of skill.prior_names ?? []) {
      assertSkillName(name, `prior name of ${skill.name}`)
      if (exact.has(name) || prior.has(name)) {
        throw new SkillsError(`manifest: name ${JSON.stringify(name)} appears more than once`)
      }
      prior.set(name, skill)
    }
  }
  for (const name of exact.keys()) {
    if (prior.has(name)) {
      throw new SkillsError(`manifest: name ${JSON.stringify(name)} is both a skill and a prior name`)
    }
  }
  return { exact, prior }
}

const skillUnderName = ({ exact, prior }: ManifestIndex, name: string): ManifestSkill | undefined =>
  exact.get(name) ?? prior.get(name)

export const fetchSkillsManifest = async (host: string): Promise<SkillsManifest> => {
  const url = urlFor(host, 'manifest.json')
  const bytes = await fetchBytes(url)
  let manifest: SkillsManifest
  try {
    manifest = JSON.parse(Buffer.from(bytes).toString('utf8')) as SkillsManifest
  } catch {
    throw new SkillsError(`${url}: invalid JSON`)
  }
  if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new SkillsError(
      `${url}: manifest schema ${String(manifest.schema_version)} is not supported by this CLI version; update the Netlify CLI`,
    )
  }
  indexManifest(manifest)
  return manifest
}

const historyOf = (skill: ManifestSkill): SkillHistoryEntry[] => {
  if (Array.isArray(skill.history) && skill.history.length > 0) {
    return skill.history
  }
  return skill.tree_hash ? [{ version: skill.version, tree_hash: skill.tree_hash }] : []
}

const lastMatching = (skill: ManifestSkill, treeHash: string | null): SkillHistoryEntry | undefined =>
  treeHash ? historyOf(skill).findLast((entry) => entry.tree_hash === treeHash) : undefined

const executableOf = (skill: ManifestSkill): Set<string> => new Set(skill.executable ?? [])

const listRegularFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []
  const walk = async (current: string, prefix: string) => {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), relative)
      } else if (entry.isFile()) {
        files.push(relative)
      } else {
        throw new SkillsError(`${path.join(current, entry.name)}: not a regular file`)
      }
    }
  }
  await walk(dir, '')
  return files.sort()
}

const isExecutable = async (absolute: string, relative: string, declared?: Set<string>): Promise<boolean> => {
  if (process.platform === 'win32') {
    return declared?.has(relative) ?? false
  }
  return ((await fs.stat(absolute)).mode & 0o111) !== 0
}

export const hashSkillTree = async (dir: string, declaredExecutable?: Set<string>): Promise<string> => {
  const hash = createHash('sha256')
  for (const relative of await listRegularFiles(dir)) {
    const absolute = path.join(dir, ...relative.split('/'))
    const bytes = await fs.readFile(absolute)
    const mode = (await isExecutable(absolute, relative, declaredExecutable)) ? '100755' : '100644'
    hash.update(`${relative}\0${mode}\0${sha256(bytes).replace(/^sha256:/, '')}\n`)
  }
  return `sha256:${hash.digest('hex')}`
}

const isFile = async (file: string): Promise<boolean> => {
  try {
    return (await fs.lstat(file)).isFile()
  } catch {
    return false
  }
}

const isDirectory = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.lstat(dir)).isDirectory()
  } catch {
    return false
  }
}

const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.lstat(file)
    return true
  } catch {
    return false
  }
}

const isDirectoryOrLinkToOne = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(dir)).isDirectory()
  } catch {
    return false
  }
}

const isOlderThan = async (file: string, ageMs: number): Promise<boolean> => {
  try {
    return Date.now() - (await fs.lstat(file)).mtimeMs >= ageMs
  } catch {
    return false
  }
}

const isSameEntry = async (a: string, b: string): Promise<boolean> => {
  try {
    const [statA, statB] = await Promise.all([fs.lstat(a), fs.lstat(b)])
    return statA.ino !== 0 && statA.ino === statB.ino && statA.dev === statB.dev
  } catch {
    return false
  }
}

const sortByName = <T extends { name: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'))

const hashIfPossible = async (dir: string, skill: ManifestSkill): Promise<string | null> => {
  try {
    return await hashSkillTree(dir, executableOf(skill))
  } catch {
    return null
  }
}

const isUneditedRelease = async (dir: string, skill: ManifestSkill): Promise<boolean> => {
  if (!(await isDirectory(dir))) {
    return false
  }
  return lastMatching(skill, await hashIfPossible(dir, skill)) !== undefined
}

export const classifySkillsDirectory = async (
  root: string,
  manifest: SkillsManifest,
): Promise<SkillsClassification> => {
  const { exact, prior } = indexManifest(manifest)
  const records: SkillRecord[] = []
  const presentActive = new Set<string>()

  let entries: Dirent[] = []
  if (await isDirectoryOrLinkToOne(root)) {
    entries = sortByName(await fs.readdir(root, { withFileTypes: true }))
  }

  for (const entry of entries) {
    if (entry.name.startsWith(STAGING_PREFIX)) continue
    const known = exact.get(entry.name)
    const renamed = prior.get(entry.name)
    const target = known?.status === 'active' ? known : renamed?.status === 'active' ? renamed : null
    const retired = known?.status === 'deprecated' ? known : renamed?.status === 'deprecated' ? renamed : null
    if (!entry.isDirectory() && !target && !retired) continue
    const dir = path.join(root, entry.name)
    const hasSkillMd = entry.isDirectory() && (await isFile(path.join(dir, 'SKILL.md')))
    if (!hasSkillMd && known?.status !== 'active') continue
    if (entry.isDirectory() && !hasSkillMd && known?.status === 'active' && (await fs.readdir(dir)).length === 0) {
      continue
    }

    const subject = target ?? retired
    const treeHash = hasSkillMd && subject ? await hashIfPossible(dir, subject) : null

    if (retired) {
      records.push({
        name: entry.name,
        status: 'deprecated',
        replacedBy: retired.deprecated?.replaced_by ?? null,
        modified: lastMatching(retired, treeHash) === undefined,
      })
      continue
    }

    if (!target) {
      records.push({ name: entry.name, status: 'unknown' })
      continue
    }

    const match = lastMatching(target, treeHash)
    if (target === renamed) {
      records.push({ name: entry.name, status: 'renamed', currentName: target.name, modified: match === undefined })
      continue
    }

    presentActive.add(target.name)
    if (treeHash === target.tree_hash) {
      records.push({ name: entry.name, status: 'current', version: target.version })
    } else if (match) {
      records.push({ name: entry.name, status: 'stale', version: target.version, have: match.version })
    } else {
      records.push({ name: entry.name, status: 'modified', version: target.version })
    }
  }

  const missing = manifest.skills
    .filter((skill) => skill.status === 'active' && !presentActive.has(skill.name))
    .map((skill) => skill.name)
    .sort()

  return { skills: records, missing }
}

const replaceDirectory = async (staged: string, target: string): Promise<void> => {
  let existing = await fs.lstat(target).catch(() => null)
  if (existing && !existing.isDirectory()) {
    await fs.rm(target, { force: true })
    existing = null
  }
  const retired = `${target}.old-${process.pid.toString()}-${randomBytes(6).toString('hex')}`
  if (existing) {
    await fs.rename(target, retired)
  }
  try {
    await fs.rename(staged, target)
  } catch (error) {
    if (existing) {
      await fs.rename(retired, target)
    }
    throw error
  }
  if (existing) {
    await fs.rm(retired, { recursive: true, force: true }).catch(() => undefined)
  }
}

const isReplaceableCopy = async (target: string, skill: ManifestSkill): Promise<boolean> => {
  if (!(await isDirectory(target))) {
    return !(await exists(target))
  }
  if ((await fs.readdir(target)).length === 0) {
    return true
  }
  return isUneditedRelease(target, skill)
}

const downloadSkill = async (host: string, skill: ManifestSkill): Promise<[string, Uint8Array][]> => {
  const downloaded: [string, Uint8Array][] = []
  for (const file of Object.keys(skill.files ?? {}).sort()) {
    if (!isSafeFilePath(file)) {
      throw new SkillsError(`${skill.name}: unsafe manifest file path: ${file}`)
    }
    let bytes: Uint8Array
    try {
      bytes = await fetchBytes(urlFor(host, 'skills', skill.name, ...file.split('/')))
    } catch (error) {
      throw new SkillsError(`${skill.name}/${file}: ${errorMessage(error)}`)
    }
    if (sha256(bytes) !== skill.files?.[file]) {
      throw new SkillsError(`${skill.name}/${file}: hash mismatch`)
    }
    downloaded.push([file, bytes])
  }
  return downloaded
}

export const installSkill = async (
  host: string,
  dest: string,
  skill: ManifestSkill,
  { force = false }: { force?: boolean } = {},
): Promise<number> => {
  const downloaded = await downloadSkill(host, skill)
  const target = path.join(dest, skill.name)
  if (!force && !(await isReplaceableCopy(target, skill))) {
    throw new SkillConflictError(`${target} already exists and is not an unedited Netlify skill; left in place`)
  }

  await fs.mkdir(dest, { recursive: true })
  const staged = await fs.mkdtemp(path.join(dest, `${STAGING_PREFIX}${skill.name}-`))
  try {
    const executable = executableOf(skill)
    for (const [file, bytes] of downloaded) {
      const output = path.join(staged, ...file.split('/'))
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, bytes, { mode: executable.has(file) ? 0o755 : 0o644 })
    }
    const stagedHash = await hashSkillTree(staged, executable)
    if (stagedHash !== skill.tree_hash) {
      throw new SkillsError(`staged tree hash ${stagedHash} does not match the manifest`)
    }
    if (!force && !(await isReplaceableCopy(target, skill))) {
      throw new SkillConflictError(`${target} changed while downloading; left in place`)
    }
    await replaceDirectory(staged, target)
  } catch (error) {
    await fs.rm(staged, { recursive: true, force: true })
    if (error instanceof SkillConflictError) throw error
    throw new SkillsError(`${skill.name}: could not install: ${errorMessage(error)}`)
  }
  return downloaded.length
}

const removeInstallLeftovers = async (root: string, index: ManifestIndex): Promise<string[]> => {
  if (!(await isDirectoryOrLinkToOne(root))) {
    return []
  }
  const removed: string[] = []
  for (const entry of sortByName(await fs.readdir(root, { withFileTypes: true }))) {
    if (!entry.isDirectory()) continue
    const leftover = path.join(root, entry.name)
    const staging = STAGING_LEFTOVER.exec(entry.name)
    if (staging) {
      if (skillUnderName(index, staging[1]) && (await isOlderThan(leftover, LEFTOVER_MIN_AGE_MS))) {
        await fs.rm(leftover, { recursive: true, force: true })
        removed.push(entry.name)
      }
      continue
    }
    const retired = RETIRED_LEFTOVER.exec(entry.name)
    const skill = retired ? skillUnderName(index, retired[1]) : undefined
    if (!retired || !skill) continue
    const skillPresent = (await exists(path.join(root, retired[1]))) || (await exists(path.join(root, skill.name)))
    if (
      skillPresent &&
      (await isOlderThan(leftover, LEFTOVER_MIN_AGE_MS)) &&
      (await isUneditedRelease(leftover, skill))
    ) {
      await fs.rm(leftover, { recursive: true, force: true })
      removed.push(entry.name)
    }
  }
  return removed
}

export const syncSkills = async ({
  host,
  directory,
  manifest,
  reset = false,
}: {
  host: string
  directory: string
  manifest: SkillsManifest
  reset?: boolean
}): Promise<SkillsSyncResult> => {
  const index = indexManifest(manifest)
  const actions: SkillActionRecord[] = []
  const act = (name: string, action: SkillAction, detail?: string) => {
    actions.push(detail ? { name, action, detail } : { name, action })
  }
  const skillByName = (name: string): ManifestSkill => {
    const skill = skillUnderName(index, name)
    if (!skill) {
      throw new SkillsError(`manifest: unknown skill ${name}`)
    }
    return skill
  }
  const stillUnedited = async (name: string, skill: ManifestSkill): Promise<boolean> =>
    reset || isUneditedRelease(path.join(directory, name), skill)
  const removeUnlessSame = async (name: string, keep: string): Promise<void> => {
    if (await isSameEntry(path.join(directory, name), path.join(directory, keep))) return
    await fs.rm(path.join(directory, name), { recursive: true, force: true })
  }
  const occupantOf = async (name: string): Promise<string | undefined> => {
    if (!(await isDirectoryOrLinkToOne(directory))) return undefined
    for (const entry of await fs.readdir(directory)) {
      if (entry === name) continue
      if (await isSameEntry(path.join(directory, entry), path.join(directory, name))) return entry
    }
    return undefined
  }

  for (const leftover of await removeInstallLeftovers(directory, index)) {
    act(leftover, 'removed', 'leftover from an interrupted install')
  }
  const before = await classifySkillsDirectory(directory, manifest)

  const installed = new Set<string>()
  const settled = new Set<string>()
  const install = async (skill: ManifestSkill, options: { force?: boolean } = {}): Promise<boolean> => {
    if (settled.has(skill.name)) return false
    const occupant = await occupantOf(skill.name)
    if (occupant) {
      settled.add(skill.name)
      act(skill.name, 'kept', `${occupant} already uses this name; left in place`)
      return false
    }
    try {
      await installSkill(host, directory, skill, options)
      installed.add(skill.name)
      return true
    } catch (error) {
      settled.add(skill.name)
      if (error instanceof SkillConflictError) {
        act(skill.name, 'kept', error.message)
      } else {
        act(skill.name, 'failed', errorMessage(error))
      }
      return false
    }
  }

  for (const record of before.skills) {
    switch (record.status) {
      case 'current':
        act(record.name, 'current', record.version ?? undefined)
        break
      case 'stale': {
        const skill = skillByName(record.name)
        if (await install(skill)) {
          act(record.name, 'updated', `${record.have ?? 'unknown'} -> ${skill.version ?? 'latest'}`)
        }
        break
      }
      case 'modified': {
        if (!reset) {
          act(record.name, 'kept', 'edited locally')
          break
        }
        const target = path.join(directory, record.name)
        if ((await isDirectory(target)) && !(await isFile(path.join(target, 'SKILL.md')))) {
          act(record.name, 'kept', 'has no SKILL.md, so it is not a Netlify skill; left in place')
          break
        }
        const skill = skillByName(record.name)
        if (await install(skill, { force: true })) {
          act(record.name, 'reset', `edited copy replaced with ${skill.version ?? 'latest'}`)
        }
        break
      }
      case 'renamed': {
        const skill = skillByName(record.currentName)
        const current = before.skills.find((other) => other.name === record.currentName)
        const currentPresent = current !== undefined || installed.has(record.currentName)
        if (!reset && record.modified) {
          act(record.name, 'kept', `edited locally; now called ${record.currentName}`)
          break
        }
        if (!reset && current?.status === 'modified') {
          act(record.name, 'kept', `${record.currentName} is already installed and edited locally`)
          break
        }
        const priorDir = path.join(directory, record.name)
        const currentDir = path.join(directory, record.currentName)
        if (!currentPresent && (await isSameEntry(priorDir, currentDir))) {
          await fs.rename(priorDir, currentDir)
          act(record.name, 'renamed', `-> ${record.currentName}`)
          if (
            (await hashIfPossible(currentDir, skill)) !== skill.tree_hash &&
            (await install(skill, { force: reset }))
          ) {
            if (record.modified) {
              act(record.currentName, 'reset', `edited copy replaced with ${skill.version ?? 'latest'}`)
            } else {
              act(record.currentName, 'updated', `-> ${skill.version ?? 'latest'}`)
            }
          }
          installed.add(record.currentName)
          break
        }
        if (!currentPresent && !(await install(skill))) {
          act(record.name, 'kept', `now called ${record.currentName}, which could not be installed`)
          break
        }
        if (!(await stillUnedited(record.name, skill))) {
          act(record.name, 'kept', `edited locally; now called ${record.currentName}`)
          break
        }
        await removeUnlessSame(record.name, record.currentName)
        if (currentPresent) {
          act(record.name, 'removed', `superseded by ${record.currentName}`)
        } else {
          act(record.name, 'renamed', `-> ${record.currentName}`)
        }
        break
      }
      case 'deprecated': {
        const retired = skillByName(record.name)
        const replacement = record.replacedBy ? `; use ${record.replacedBy}` : ''
        if ((record.modified && !reset) || !(await stillUnedited(record.name, retired))) {
          act(record.name, 'kept', `deprecated${replacement}, but edited locally`)
          break
        }
        await fs.rm(path.join(directory, record.name), { recursive: true, force: true })
        act(record.name, 'removed', `deprecated${replacement}`)
        break
      }
      case 'unknown':
        act(record.name, 'ignored', 'not a Netlify skill')
        break
    }
  }

  for (const name of before.missing) {
    if (installed.has(name)) continue
    const skill = skillByName(name)
    if (await install(skill)) {
      act(name, 'added', skill.version ?? undefined)
    }
  }

  return { directory, actions }
}

export const resolveSkillsDirectories = async (
  workingDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> => {
  const present: string[] = []
  for (const agentDirectory of AGENT_DIRECTORIES) {
    if (await isDirectoryOrLinkToOne(path.join(workingDir, agentDirectory))) {
      present.push(path.join(agentDirectory, 'skills'))
    }
  }
  if (present.length > 0) {
    return present
  }
  const drivingAgent = getDrivingAgent(env)
  const agentDirectory = drivingAgent ? AGENT_DIRECTORY_BY_DRIVING_AGENT[drivingAgent.name] : undefined
  return [agentDirectory ? path.join(agentDirectory, 'skills') : DEFAULT_SKILLS_DIRECTORY]
}

const summarize = (actions: SkillActionRecord[]): Record<SkillAction, number> => {
  const summary: Record<SkillAction, number> = {
    current: 0,
    added: 0,
    updated: 0,
    reset: 0,
    renamed: 0,
    removed: 0,
    kept: 0,
    ignored: 0,
    failed: 0,
  }
  for (const { action } of actions) {
    summary[action] += 1
  }
  return summary
}

const describeSync = ({ directory, actions }: SkillsSyncResult): string => {
  const summary = summarize(actions)
  const location = chalk.underline(directory)
  const changed = summary.added + summary.updated + summary.reset + summary.renamed + summary.removed
  const parts = [
    summary.added > 0 ? `${summary.added.toString()} added` : '',
    summary.updated > 0 ? `${summary.updated.toString()} updated` : '',
    summary.reset > 0 ? `${summary.reset.toString()} reset` : '',
    summary.renamed > 0 ? `${summary.renamed.toString()} renamed` : '',
    summary.removed > 0 ? `${summary.removed.toString()} removed` : '',
    summary.kept > 0 ? `${summary.kept.toString()} kept` : '',
    summary.failed > 0 ? `${summary.failed.toString()} failed` : '',
  ].filter(Boolean)
  if (changed + summary.failed === 0) {
    return `Netlify skills in ${location} are up to date${parts.length > 0 ? ` (${parts.join(', ')})` : ''}.`
  }
  if (changed === 0) {
    return `Could not sync Netlify skills in ${location} (${parts.join(', ')}).`
  }
  const verb = changed === summary.added && summary.failed === 0 ? 'Installed' : 'Synced'
  return `${verb} Netlify skills in ${location} (${parts.join(', ')}).`
}

const logSync = (directory: string, result: SkillsSyncResult, reset: boolean): void => {
  log(describeSync({ directory, actions: result.actions }))
  const listed = result.actions.filter(({ action }) => action === 'kept' || action === 'failed')
  for (const { name, action, detail } of listed) {
    log(`  ${chalk.dim(name)}: ${detail ?? action}`)
  }
  if (!reset && listed.some(({ action, detail }) => action === 'kept' && detail?.includes('edited locally'))) {
    log(
      `  Run ${chalk.cyanBright.bold(`${netlifyCommand()} init --reset-context`)} to replace edited Netlify skills with the latest release.`,
    )
  }
}

export interface AgentSkillsSetupSummary {
  installed: boolean
  directories: string[]
  skillsVersion?: string
  summary: Record<SkillAction, number>
  error?: string
}

export const setupAgentSkills = async ({
  workingDir,
  env = process.env,
  reset = false,
}: {
  workingDir: string
  env?: NodeJS.ProcessEnv
  reset?: boolean
}): Promise<AgentSkillsSetupSummary> => {
  let directories: string[] = []
  try {
    directories = await resolveSkillsDirectories(workingDir, env)
    const host = resolveSkillsHost(env)
    const manifest = await fetchSkillsManifest(host)
    const actions: SkillActionRecord[] = []
    for (const directory of directories) {
      const result = await syncSkills({ host, directory: path.resolve(workingDir, directory), manifest, reset })
      actions.push(...result.actions)
      logSync(directory, result, reset)
    }
    const summary = summarize(actions)
    return {
      installed: summary.current + summary.added + summary.updated + summary.reset + summary.renamed + summary.kept > 0,
      directories,
      skillsVersion: manifest.version,
      summary,
    }
  } catch (error) {
    const message = errorMessage(error)
    warn(`Could not set up Netlify skills for AI agents: ${message}`)
    log(
      `Run ${chalk.cyanBright.bold(`${netlifyCommand()} init`)} again later, or use ${chalk.cyan('--skip-agent-setup')} to opt out.`,
    )
    return { installed: false, directories, summary: summarize([]), error: message }
  }
}
