import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { SkillsSyncResult } from './agent-skills.js'

export const AGENT_SKILLS_STATE_FILE = path.join('.netlify', 'agent-skills.json')

export interface AgentSkillsState {
  /** When a refresh was last started, in milliseconds since the epoch. */
  checkedAt?: number
  /** ETag of the last manifest that was synced without failures. */
  etag?: string
  /** Every skill name the project has been offered, so a skill someone deleted is not added back. */
  knownSkills?: string[]
  /** Changes made by a background refresh that have not been shown yet. */
  notice?: SkillsSyncResult[]
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const parseState = (raw: string): AgentSkillsState => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    return {}
  }
  const { checkedAt, etag, knownSkills, notice } = parsed as Record<string, unknown>
  return {
    ...(typeof checkedAt === 'number' ? { checkedAt } : {}),
    ...(typeof etag === 'string' ? { etag } : {}),
    ...(isStringArray(knownSkills) ? { knownSkills } : {}),
    ...(Array.isArray(notice) ? { notice: notice as SkillsSyncResult[] } : {}),
  }
}

export const readAgentSkillsState = async (repositoryRoot: string): Promise<AgentSkillsState> => {
  try {
    return parseState(await fs.readFile(path.join(repositoryRoot, AGENT_SKILLS_STATE_FILE), 'utf8'))
  } catch {
    return {}
  }
}

/** Applies `update` to the stored state and writes the result atomically. */
export const updateAgentSkillsState = async (
  repositoryRoot: string,
  update: (state: AgentSkillsState) => AgentSkillsState,
): Promise<void> => {
  const file = path.join(repositoryRoot, AGENT_SKILLS_STATE_FILE)
  const next = update(await readAgentSkillsState(repositoryRoot))
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid.toString()}-${randomBytes(4).toString('hex')}`
  await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`)
  try {
    await fs.rename(temporary, file)
  } catch (error) {
    await fs.rm(temporary, { force: true })
    throw error
  }
}
