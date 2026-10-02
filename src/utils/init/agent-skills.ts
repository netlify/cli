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
  claudeai: '.claude',
}

const SKILL_NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/
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
  | { name: string; status: 'duplicate'; currentName: string }
  | { name: string; status: 'unknown' }

export interface SkillsClassification {
  skills: SkillRecord[]
  missing: string[]
}

export type SkillAction = 'current' | 'added' | 'updated' | 'renamed' | 'removed' | 'kept' | 'ignored'

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
  const response = await fetch(url, { headers: { 'user-agent': `NetlifyCLI ${version}` } })
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

export const hashSkillTree = async (dir: string): Promise<string> => {
  const hash = createHash('sha256')
  for (const relative of await listRegularFiles(dir)) {
    const absolute = path.join(dir, ...relative.split('/'))
    const [bytes, stat] = await Promise.all([fs.readFile(absolute), fs.stat(absolute)])
    const mode = stat.mode & 0o111 ? '100755' : '100644'
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
  if (await isDirectory(root)) {
    entries = sortByName(await fs.readdir(root, { withFileTypes: true }))
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const known = exact.get(entry.name)
    const renamed = prior.get(entry.name)
    const target = known?.status === 'active' ? known : renamed?.status === 'active' ? renamed : null
    const retired = known?.status === 'deprecated' ? known : renamed?.status === 'deprecated' ? renamed : null
    const dir = path.join(root, entry.name)
    const hasSkillMd = await isFile(path.join(dir, 'SKILL.md'))
    if (!hasSkillMd && !target && !retired) continue

    let treeHash: string | null = null
    if (hasSkillMd) {
      try {
        treeHash = await hashSkillTree(dir)
      } catch {
        treeHash = null
      }
    }

    if (retired) {
      const match = lastMatching(retired, treeHash)
      records.push({
        name: entry.name,
        status: 'deprecated',
        replacedBy: retired.deprecated?.replaced_by ?? null,
        modified: !match,
      })
      continue
    }

    if (!target) {
      const twin = treeHash
        ? manifest.skills.find(
            (skill) => skill.status === 'active' && historyOf(skill).some((item) => item.tree_hash === treeHash),
          )
        : undefined
      records.push(
        twin
          ? { name: entry.name, status: 'duplicate', currentName: twin.name }
          : { name: entry.name, status: 'unknown' },
      )
      continue
    }

    const match = lastMatching(target, treeHash)
    if (target === renamed) {
      records.push({ name: entry.name, status: 'renamed', currentName: target.name, modified: !match })
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
    await fs.rm(retired, { recursive: true, force: true })
  }
}

export const installSkill = async (host: string, dest: string, skill: ManifestSkill): Promise<number> => {
  const files = Object.keys(skill.files ?? {}).sort()
  const downloaded: [string, Uint8Array][] = []
  for (const file of files) {
    if (!isSafeFilePath(file)) {
      throw new SkillsError(`${skill.name}: unsafe manifest file path: ${file}`)
    }
    const bytes = await fetchBytes(urlFor(host, 'skills', skill.name, ...file.split('/')))
    if (sha256(bytes) !== skill.files?.[file]) {
      throw new SkillsError(`${skill.name}/${file}: hash mismatch`)
    }
    downloaded.push([file, bytes])
  }

  await fs.mkdir(dest, { recursive: true })
  const staged = await fs.mkdtemp(path.join(dest, `.netlify-skill-${skill.name}-`))
  try {
    const executable = new Set(skill.executable ?? [])
    for (const [file, bytes] of downloaded) {
      const output = path.join(staged, ...file.split('/'))
      await fs.mkdir(path.dirname(output), { recursive: true })
      await fs.writeFile(output, bytes, { mode: executable.has(file) ? 0o755 : 0o644 })
    }
    await replaceDirectory(staged, path.join(dest, skill.name))
  } catch (error) {
    await fs.rm(staged, { recursive: true, force: true })
    throw new SkillsError(`${skill.name}: could not install: ${(error as Error).message}`)
  }
  return files.length
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
  const installed = new Set<string>()
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

  for (const record of before.skills) {
    const dir = path.join(directory, record.name)
    switch (record.status) {
      case 'current':
        act(record.name, 'current', record.version ?? undefined)
        break
      case 'stale': {
        const skill = skillByName(record.name)
        await installSkill(host, directory, skill)
        act(record.name, 'updated', `${record.have ?? 'unknown'} -> ${skill.version ?? 'latest'}`)
        break
      }
      case 'modified':
        act(record.name, 'kept', 'edited locally')
        break
      case 'renamed': {
        const current = before.skills.find((other) => other.name === record.currentName)
        if (record.modified) {
          act(record.name, 'kept', `edited locally; now called ${record.currentName}`)
        } else if (current?.status === 'modified') {
          act(record.name, 'kept', `${record.currentName} is already installed and edited locally`)
        } else if (current) {
          await fs.rm(dir, { recursive: true, force: true })
          act(record.name, 'removed', `superseded by ${record.currentName}`)
        } else {
          await installSkill(host, directory, skillByName(record.currentName))
          installed.add(record.currentName)
          await fs.rm(dir, { recursive: true, force: true })
          act(record.name, 'renamed', `-> ${record.currentName}`)
        }
        break
      }
      case 'deprecated': {
        const replacement = record.replacedBy ? `; use ${record.replacedBy}` : ''
        if (record.modified) {
          act(record.name, 'kept', `deprecated${replacement}, but edited locally`)
        } else {
          await fs.rm(dir, { recursive: true, force: true })
          act(record.name, 'removed', `deprecated${replacement}`)
        }
        break
      }
      case 'duplicate':
        act(record.name, 'ignored', `copy of ${record.currentName} under another name`)
        break
      case 'unknown':
        act(record.name, 'ignored', 'not a Netlify skill')
        break
    }
  }

  for (const name of before.missing) {
    if (installed.has(name)) continue
    const skill = skillByName(name)
    await installSkill(host, directory, skill)
    act(name, 'added', skill.version ?? undefined)
  }

  return { directory, actions }
}

export const resolveSkillsDirectories = async (
  workingDir: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> => {
  const present: string[] = []
  for (const agentDirectory of AGENT_DIRECTORIES) {
    if (await isDirectory(path.join(workingDir, agentDirectory))) {
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
    renamed: 0,
    removed: 0,
    kept: 0,
    ignored: 0,
  }
  for (const { action } of actions) {
    summary[action] += 1
  }
  return summary
}

const describeSync = ({ directory, actions }: SkillsSyncResult): string => {
  const summary = summarize(actions)
  const changed = summary.added + summary.updated + summary.renamed + summary.removed
  const location = chalk.underline(directory)
  if (changed === 0) {
    return `Netlify skills in ${location} are up to date.`
  }
  const parts = [
    summary.added > 0 ? `${summary.added.toString()} added` : '',
    summary.updated > 0 ? `${summary.updated.toString()} updated` : '',
    summary.renamed > 0 ? `${summary.renamed.toString()} renamed` : '',
    summary.removed > 0 ? `${summary.removed.toString()} removed` : '',
    summary.kept > 0 ? `${summary.kept.toString()} kept (edited locally)` : '',
  ].filter(Boolean)
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
  const directories = await resolveSkillsDirectories(workingDir, env)
  try {
    const host = resolveSkillsHost(env)
    const manifest = await fetchSkillsManifest(host)
    const actions: SkillActionRecord[] = []
    for (const directory of directories) {
      const result = await syncSkills({ host, directory: path.resolve(workingDir, directory), manifest })
      actions.push(...result.actions)
      log(describeSync({ directory, actions: result.actions }))
    }
    return { installed: true, directories, skillsVersion: manifest.version, summary: summarize(actions) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn(`Could not set up Netlify skills for AI agents: ${message}`)
    log(
      `Run ${chalk.cyanBright.bold(`${netlifyCommand()} init`)} again later, or use ${chalk.cyan('--skip-agent-setup')} to opt out.`,
    )
    return { installed: false, directories, summary: summarize([]), error: message }
  }
}
