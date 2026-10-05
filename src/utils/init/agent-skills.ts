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
const FETCH_TIMEOUT_MS = 10_000
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
  | { name: string; status: 'renamed'; currentName: string }
  | { name: string; status: 'deprecated'; replacedBy: string | null }
  | { name: string; status: 'unknown' }

export interface SkillsClassification {
  skills: SkillRecord[]
  missing: string[]
}

export type SkillAction = 'current' | 'added' | 'updated' | 'kept' | 'ignored' | 'failed'

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
  return error instanceof Error ? error.message : String(error)
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

const sortByName = <T extends { name: string }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => a.name.localeCompare(b.name, 'en'))

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
    const known = exact.get(entry.name)
    const renamed = prior.get(entry.name)
    if (!entry.isDirectory() && !known && !renamed) continue
    const dir = path.join(root, entry.name)
    const hasSkillMd = entry.isDirectory() && (await isFile(path.join(dir, 'SKILL.md')))
    if (!hasSkillMd && !known && !renamed) continue
    if (entry.isDirectory() && !hasSkillMd && known?.status === 'active' && (await fs.readdir(dir)).length === 0) {
      continue
    }

    if (known?.status === 'deprecated' || renamed?.status === 'deprecated') {
      const retired = known?.status === 'deprecated' ? known : renamed
      records.push({ name: entry.name, status: 'deprecated', replacedBy: retired?.deprecated?.replaced_by ?? null })
      continue
    }
    if (!known && renamed) {
      records.push({ name: entry.name, status: 'renamed', currentName: renamed.name })
      continue
    }
    if (!known) {
      records.push({ name: entry.name, status: 'unknown' })
      continue
    }

    presentActive.add(known.name)
    let treeHash: string | null = null
    if (hasSkillMd) {
      try {
        treeHash = await hashSkillTree(dir, new Set(known.executable ?? []))
      } catch {
        treeHash = null
      }
    }
    const match = lastMatching(known, treeHash)
    if (treeHash === known.tree_hash) {
      records.push({ name: entry.name, status: 'current', version: known.version })
    } else if (match) {
      records.push({ name: entry.name, status: 'stale', version: known.version, have: match.version })
    } else {
      records.push({ name: entry.name, status: 'modified', version: known.version })
    }
  }

  const missing = manifest.skills
    .filter((skill) => skill.status === 'active' && !presentActive.has(skill.name))
    .map((skill) => skill.name)
    .sort()

  return { skills: records, missing }
}

const replaceDirectory = async (staged: string, target: string): Promise<void> => {
  const exists = await isDirectory(target)
  const retired = `${target}.old-${process.pid.toString()}-${randomBytes(6).toString('hex')}`
  if (exists) {
    await fs.rename(target, retired)
  }
  try {
    await fs.rename(staged, target)
  } catch (error) {
    if (exists) {
      await fs.rename(retired, target)
    }
    throw error
  }
  if (exists) {
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
  try {
    const treeHash = await hashSkillTree(target, new Set(skill.executable ?? []))
    return historyOf(skill).some((entry) => entry.tree_hash === treeHash)
  } catch {
    return false
  }
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

export const installSkill = async (host: string, dest: string, skill: ManifestSkill): Promise<number> => {
  const downloaded = await downloadSkill(host, skill)
  const target = path.join(dest, skill.name)
  if (!(await isReplaceableCopy(target, skill))) {
    throw new SkillConflictError(`${target} already exists and is not an unedited Netlify skill; left in place`)
  }

  await fs.mkdir(dest, { recursive: true })
  const staged = await fs.mkdtemp(path.join(dest, `${STAGING_PREFIX}${skill.name}-`))
  try {
    const executable = new Set(skill.executable ?? [])
    for (const [file, bytes] of downloaded) {
      const output = path.join(staged, ...file.split('/'))
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, bytes, { mode: executable.has(file) ? 0o755 : 0o644 })
    }
    if (!(await isReplaceableCopy(target, skill))) {
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

export const syncSkills = async ({
  host,
  directory,
  manifest,
}: {
  host: string
  directory: string
  manifest: SkillsManifest
}): Promise<SkillsSyncResult> => {
  const { exact } = indexManifest(manifest)
  const before = await classifySkillsDirectory(directory, manifest)
  const actions: SkillActionRecord[] = []
  const act = (name: string, action: SkillAction, detail?: string) => {
    actions.push(detail ? { name, action, detail } : { name, action })
  }
  const skillByName = (name: string): ManifestSkill => {
    const skill = exact.get(name)
    if (!skill) {
      throw new SkillsError(`manifest: unknown skill ${name}`)
    }
    return skill
  }

  const install = async (name: string, onInstalled: (skill: ManifestSkill) => void) => {
    const skill = skillByName(name)
    try {
      await installSkill(host, directory, skill)
      onInstalled(skill)
    } catch (error) {
      if (error instanceof SkillConflictError) {
        act(name, 'kept', error.message)
      } else {
        act(name, 'failed', errorMessage(error))
      }
    }
  }

  for (const record of before.skills) {
    switch (record.status) {
      case 'current':
        act(record.name, 'current', record.version ?? undefined)
        break
      case 'stale':
        await install(record.name, (skill) => {
          act(record.name, 'updated', `${record.have ?? 'unknown'} -> ${skill.version ?? 'latest'}`)
        })
        break
      case 'modified':
        act(record.name, 'kept', 'edited locally')
        break
      case 'renamed':
        act(record.name, 'kept', `now called ${record.currentName}; this copy can be removed`)
        break
      case 'deprecated':
        act(record.name, 'kept', `deprecated${record.replacedBy ? `; use ${record.replacedBy}` : ''}`)
        break
      case 'unknown':
        act(record.name, 'ignored', 'not a Netlify skill')
        break
    }
  }

  for (const name of before.missing) {
    await install(name, (skill) => {
      act(name, 'added', skill.version ?? undefined)
    })
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
  const summary: Record<SkillAction, number> = { current: 0, added: 0, updated: 0, kept: 0, ignored: 0, failed: 0 }
  for (const { action } of actions) {
    summary[action] += 1
  }
  return summary
}

const describeSync = ({ directory, actions }: SkillsSyncResult): string => {
  const summary = summarize(actions)
  const location = chalk.underline(directory)
  const parts = [
    summary.added > 0 ? `${summary.added.toString()} added` : '',
    summary.updated > 0 ? `${summary.updated.toString()} updated` : '',
    summary.kept > 0 ? `${summary.kept.toString()} kept` : '',
    summary.failed > 0 ? `${summary.failed.toString()} failed` : '',
  ].filter(Boolean)
  if (summary.added + summary.updated + summary.failed === 0) {
    return `Netlify skills in ${location} are up to date${parts.length > 0 ? ` (${parts.join(', ')})` : ''}.`
  }
  return `Installed Netlify skills in ${location} (${parts.join(', ')}).`
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
}: {
  workingDir: string
  env?: NodeJS.ProcessEnv
}): Promise<AgentSkillsSetupSummary> => {
  let directories: string[] = []
  try {
    directories = await resolveSkillsDirectories(workingDir, env)
    const host = resolveSkillsHost(env)
    const manifest = await fetchSkillsManifest(host)
    const actions: SkillActionRecord[] = []
    for (const directory of directories) {
      const result = await syncSkills({ host, directory: path.resolve(workingDir, directory), manifest })
      actions.push(...result.actions)
      log(describeSync({ directory, actions: result.actions }))
      for (const { name, action, detail } of result.actions) {
        if (action === 'kept' || action === 'failed') {
          log(`  ${chalk.dim(name)}: ${detail ?? action}`)
        }
      }
    }
    const summary = summarize(actions)
    return {
      installed: summary.current + summary.added + summary.updated > 0,
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
