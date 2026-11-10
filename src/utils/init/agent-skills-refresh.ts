import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { isCI } from 'ci-info'

import execa from '../execa.js'

import {
  AGENT_DIRECTORIES,
  LEFTOVER_DETAIL,
  type ManifestSkill,
  type SkillActionRecord,
  type SkillsSyncResult,
  describeSync,
  fetchSkillsManifestIfChanged,
  recordSync,
  resolveSkillsHost,
  syncSkills,
} from './agent-skills.js'
import { readAgentSkillsState, updateAgentSkillsState } from './agent-skills-state.js'

export const AUTO_UPDATE_ENV = 'NETLIFY_SKILLS_AUTO_UPDATE'
export const REFRESH_INTERVAL_MS = 60 * 60_000

const SKILL_PREFIX = 'netlify-'
const DISABLED_VALUES = new Set(['0', 'false', 'no', 'off'])
const CHANGED_ACTIONS = new Set(['added', 'updated', 'reset', 'renamed', 'removed'])
const WORKER_PATH = fileURLToPath(new URL('agent-skills-refresh-worker.js', import.meta.url))

const hasSkillFile = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(path.join(dir, 'SKILL.md'))).isFile()
  } catch {
    return false
  }
}

/**
 * Lists the skills directories, relative to `repositoryRoot`, that already hold a Netlify skill.
 * A background refresh only writes to these, so it never adds skills to a project, or to an agent
 * directory, that has none.
 */
export const installedSkillsDirectories = async (
  repositoryRoot: string,
  knownSkills: string[] = [],
): Promise<string[]> => {
  const known = new Set(knownSkills)
  const found: string[] = []
  for (const agentDirectory of AGENT_DIRECTORIES) {
    const directory = path.join(agentDirectory, 'skills')
    let names: string[]
    try {
      names = await fs.readdir(path.join(repositoryRoot, directory))
    } catch {
      continue
    }
    for (const name of names) {
      const candidate = known.has(name) || name.startsWith(SKILL_PREFIX)
      if (candidate && (await hasSkillFile(path.join(repositoryRoot, directory, name)))) {
        found.push(directory)
        break
      }
    }
  }
  return found
}

const isDisabled = (env: NodeJS.ProcessEnv): boolean =>
  DISABLED_VALUES.has(env[AUTO_UPDATE_ENV]?.trim().toLowerCase() ?? '')

const isDue = (checkedAt: number | undefined, now: number): boolean =>
  checkedAt === undefined || now < checkedAt || now - checkedAt >= REFRESH_INTERVAL_MS

const spawnRefreshWorker = (repositoryRoot: string): void => {
  const child = execa(process.execPath, [WORKER_PATH, repositoryRoot], { detached: true, stdio: 'ignore' })
  child.catch(() => undefined)
  child.unref()
}

/**
 * Starts a background refresh of the project's Netlify skills when one is due, and returns whether
 * it did. Only local files are read here. The manifest request and any downloads happen in a
 * detached process, so the calling command never waits for them.
 */
export const startAgentSkillsRefresh = async ({
  repositoryRoot,
  env = process.env,
  now = Date.now(),
  ci = isCI,
  spawn = spawnRefreshWorker,
}: {
  repositoryRoot: string
  env?: NodeJS.ProcessEnv
  now?: number
  ci?: boolean
  spawn?: (repositoryRoot: string) => void
}): Promise<boolean> => {
  if (ci || isDisabled(env)) {
    return false
  }
  const state = await readAgentSkillsState(repositoryRoot)
  if (!isDue(state.checkedAt, now)) {
    return false
  }
  if ((await installedSkillsDirectories(repositoryRoot, state.knownSkills)).length === 0) {
    return false
  }
  // Claiming the slot before spawning keeps commands started at the same time from each spawning one.
  await updateAgentSkillsState(repositoryRoot, (current) => ({ ...current, checkedAt: now }))
  spawn(repositoryRoot)
  return true
}

const isChange = ({ action, detail }: SkillActionRecord): boolean =>
  CHANGED_ACTIONS.has(action) && detail !== LEFTOVER_DETAIL

/**
 * Runs in the detached process. When the manifest changed since the last sync, brings every
 * directory that already holds Netlify skills up to date and saves what changed for the next
 * command to show. A skill missing from a directory is added only if the project has never been
 * offered it, so skills someone deleted stay deleted.
 */
export const refreshAgentSkills = async ({
  repositoryRoot,
  env = process.env,
}: {
  repositoryRoot: string
  env?: NodeJS.ProcessEnv
}): Promise<SkillsSyncResult[]> => {
  const state = await readAgentSkillsState(repositoryRoot)
  const directories = await installedSkillsDirectories(repositoryRoot, state.knownSkills)
  if (directories.length === 0) {
    return []
  }
  const host = resolveSkillsHost(env)
  const fetched = await fetchSkillsManifestIfChanged(host, state.etag)
  if (!fetched) {
    return []
  }

  const { manifest, etag } = fetched
  const known = new Set(state.knownSkills)
  const isNew = (skill: ManifestSkill): boolean =>
    state.knownSkills !== undefined && ![skill.name, ...(skill.prior_names ?? [])].some((name) => known.has(name))

  const results: SkillsSyncResult[] = []
  for (const directory of directories) {
    const { actions } = await syncSkills({
      host,
      directory: path.join(repositoryRoot, directory),
      manifest,
      shouldAdd: isNew,
    })
    results.push({ directory, actions })
  }

  const failed = results.some(({ actions }) => actions.some(({ action }) => action === 'failed'))
  const changes = results
    .map(({ directory, actions }) => ({ directory, actions: actions.filter(isChange) }))
    .filter(({ actions }) => actions.length > 0)
  await recordSync(repositoryRoot, manifest, failed ? null : etag, changes)
  return changes
}

/** Shows what earlier background refreshes changed, once, and returns the lines it wrote. */
export const showAgentSkillsRefreshNotice = async ({
  repositoryRoot,
  write = (line: string) => process.stderr.write(`${line}\n`),
}: {
  repositoryRoot: string
  write?: (line: string) => void
}): Promise<string[]> => {
  const { notice } = await readAgentSkillsState(repositoryRoot)
  if (!notice?.length) {
    return []
  }
  await updateAgentSkillsState(repositoryRoot, (current) => {
    const next = { ...current }
    delete next.notice
    return next
  })
  const lines = notice.map((result) => describeSync(result))
  for (const line of lines) {
    write(line)
  }
  return lines
}
