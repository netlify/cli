// Entry point of the detached process that `startAgentSkillsRefresh` spawns.
import process from 'process'

import { refreshAgentSkills } from './agent-skills-refresh.js'

// Installs stage and rename each skill, so stopping mid-sync leaves no half-written skill.
const WORKER_TIMEOUT_MS = 2 * 60_000

// eslint-disable-next-line n/no-process-exit
setTimeout(() => process.exit(0), WORKER_TIMEOUT_MS).unref()

const [repositoryRoot] = process.argv.slice(2)

if (repositoryRoot) {
  try {
    await refreshAgentSkills({ repositoryRoot })
  } catch {
    // The command that started this has moved on, so there is nobody to tell. The next check retries.
  }
}
