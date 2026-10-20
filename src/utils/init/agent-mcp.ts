import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'

import { checkbox } from '@inquirer/prompts'
import { getGlobalConfigStore } from '@netlify/dev-utils'

import { type CanonicalAgentName, getDrivingAgent } from '../agent-detection.js'
import { chalk, log, netlifyCommand, warn } from '../command-helpers.js'
import execa from '../execa.js'
import { isInteractive } from '../scripted-commands.js'

export const NETLIFY_MCP_URL = 'https://mcp.netlify.com/mcp'
export const NETLIFY_MCP_SERVER_NAME = 'netlify'
const LEGACY_MCP_HOST = 'netlify-mcp.netlify.app'
const NATIVE_TIMEOUT_MS = 15_000
const ADD_MCP_VERSION = '2.4.1'

interface NativeSetup {
  lookup?: string[]
  add: string[]
  remove?: string[]
}

export interface McpAgent {
  id: string
  label: string
  binary?: string
  drivenBy?: CanonicalAgentName[]
  projectMarkers?: string[]
  inTerminal?: (env: NodeJS.ProcessEnv) => boolean
  native?: NativeSetup
}

const inEditorTerminal = (env: NodeJS.ProcessEnv): boolean => env.TERM_PROGRAM === 'vscode'

export const MCP_AGENTS: McpAgent[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    binary: 'claude',
    drivenBy: ['claude'],
    projectMarkers: ['.claude', '.mcp.json', 'CLAUDE.md'],
    native: {
      lookup: ['mcp', 'get', NETLIFY_MCP_SERVER_NAME],
      add: ['mcp', 'add', '--transport', 'http', '--scope', 'user', NETLIFY_MCP_SERVER_NAME, NETLIFY_MCP_URL],
      remove: ['mcp', 'remove', '--scope', 'user', NETLIFY_MCP_SERVER_NAME],
    },
  },
  {
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    drivenBy: ['codex'],
    projectMarkers: ['.codex'],
    native: {
      lookup: ['mcp', 'get', NETLIFY_MCP_SERVER_NAME],
      add: ['mcp', 'add', NETLIFY_MCP_SERVER_NAME, '--url', NETLIFY_MCP_URL],
      remove: ['mcp', 'remove', NETLIFY_MCP_SERVER_NAME],
    },
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    binary: 'opencode',
    drivenBy: ['opencode'],
    projectMarkers: ['opencode.json', 'opencode.jsonc', '.opencode'],
    native: { add: ['mcp', 'add', NETLIFY_MCP_SERVER_NAME, '--url', NETLIFY_MCP_URL] },
  },
  {
    id: 'vscode',
    label: 'VS Code',
    binary: 'code',
    projectMarkers: [path.join('.vscode', 'mcp.json')],
    inTerminal: (env) => inEditorTerminal(env) && !env.CURSOR_TRACE_ID,
    native: {
      add: ['--add-mcp', JSON.stringify({ name: NETLIFY_MCP_SERVER_NAME, type: 'http', url: NETLIFY_MCP_URL })],
    },
  },
  {
    id: 'cursor',
    label: 'Cursor',
    binary: 'cursor-agent',
    drivenBy: ['cursor'],
    projectMarkers: ['.cursor'],
    inTerminal: (env) => inEditorTerminal(env) && Boolean(env.CURSOR_TRACE_ID),
  },
  { id: 'windsurf', label: 'Windsurf', binary: 'windsurf', projectMarkers: ['.windsurf'] },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    binary: 'gemini',
    drivenBy: ['gemini'],
    projectMarkers: ['.gemini', 'GEMINI.md'],
  },
  { id: 'github-copilot-cli', label: 'GitHub Copilot CLI', binary: 'copilot', drivenBy: ['copilot'] },
  { id: 'kiro-cli', label: 'Kiro CLI', binary: 'kiro-cli', drivenBy: ['kiro'], projectMarkers: ['.kiro'] },
  { id: 'cline', label: 'Cline', drivenBy: ['cline'], projectMarkers: ['.clinerules'] },
]

export type AgentMcpStatus = 'added' | 'present' | 'kept' | 'printed' | 'declined' | 'failed'
export type AgentSelection = 'driving' | 'prompt' | 'saved' | 'none'

export interface AgentMcpSetupSummary {
  selection: AgentSelection
  agents: Record<string, AgentMcpStatus>
  failed?: boolean
}

export interface AgentCandidate {
  agent: McpAgent
  detected: boolean
}

export type ChooseAgents = (candidates: AgentCandidate[]) => Promise<McpAgent[]>

const chooseWithPrompt: ChooseAgents = async (candidates) =>
  await checkbox({
    message: 'Add the Netlify MCP server to which AI agents? It is added for your user, across all your projects.',
    choices: candidates.map(({ agent, detected }) => ({ name: agent.label, value: agent, checked: detected })),
  })

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

const isExecutableFile = async (target: string): Promise<boolean> => {
  try {
    if (!(await fs.stat(target)).isFile()) {
      return false
    }
    await fs.access(target, process.platform === 'win32' ? fsConstants.F_OK : fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

const findOnPath = async (binary: string, env: NodeJS.ProcessEnv): Promise<string | undefined> => {
  const extensions = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : ['']
  const candidates = (env.PATH ?? '')
    .split(path.delimiter)
    .filter((directory) => path.isAbsolute(directory))
    .flatMap((directory) => extensions.map((extension) => path.join(directory, binary + extension)))
  const executable = await Promise.all(candidates.map(isExecutableFile))
  return candidates.find((_, index) => executable[index])
}

const hasProjectMarker = async (agent: McpAgent, workingDir: string): Promise<boolean> => {
  for (const marker of agent.projectMarkers ?? []) {
    if (await pathExists(path.join(workingDir, marker))) {
      return true
    }
  }
  return false
}

export const findCandidates = async (workingDir: string, env: NodeJS.ProcessEnv): Promise<AgentCandidate[]> => {
  const candidates: AgentCandidate[] = []
  for (const agent of MCP_AGENTS) {
    const detected = Boolean(agent.inTerminal?.(env)) || (await hasProjectMarker(agent, workingDir))
    if (detected || (agent.binary !== undefined && (await findOnPath(agent.binary, env)) !== undefined)) {
      candidates.push({ agent, detected })
    }
  }
  return candidates.sort((a, b) => Number(b.detected) - Number(a.detected))
}

const addMcpCommand = (agents: McpAgent[]): string =>
  [
    `npx -y add-mcp@${ADD_MCP_VERSION}`,
    NETLIFY_MCP_URL,
    '--name',
    NETLIFY_MCP_SERVER_NAME,
    '-g',
    ...agents.flatMap(({ id }) => ['-a', id]),
  ].join(' ')

const shellQuote = (arg: string): string => {
  if (/^[\w@%+=:,./\\-]+$/.test(arg)) {
    return arg
  }
  return process.platform === 'win32' ? `"${arg.replace(/"/g, '\\"')}"` : `'${arg.replace(/'/g, `'\\''`)}'`
}

const formatCommand = (binary: string, args: string[]): string =>
  chalk.cyanBright.bold([binary, ...args].map(shellQuote).join(' '))

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException =>
  value instanceof Error && Object.hasOwn(value, 'code')

const runNative = async (executable: string, args: string[], cwd: string) => {
  const result = await execa(executable, args, { cwd, reject: false, stdin: 'ignore', timeout: NATIVE_TIMEOUT_MS })
  return {
    missingBinary: isErrnoException(result) && result.code === 'ENOENT',
    exitCode: result.exitCode,
    output: [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
    timedOut: result.timedOut,
  }
}

type NativeRun = Awaited<ReturnType<typeof runNative>>

const describeFailure = ({ timedOut, output, exitCode }: NativeRun): string =>
  timedOut
    ? `timed out after ${(NATIVE_TIMEOUT_MS / 1000).toString()} seconds`
    : output || `exit code ${String(exitCode)}`

type NativeAgent = McpAgent & { binary: string; native: NativeSetup }

const hasNativeSetup = (agent: McpAgent): agent is NativeAgent =>
  agent.binary !== undefined && agent.native !== undefined

type Existing = { found: 'ours' | 'other'; output: string }
type Lookup = Existing | { found: 'none' } | { found: 'unknown'; run: NativeRun }

const lookUp = async (executable: string, lookup: string[], workingDir: string): Promise<Lookup> => {
  const run = await runNative(executable, lookup, workingDir)
  if (run.exitCode === 0) {
    return { found: run.output.includes(NETLIFY_MCP_URL) ? 'ours' : 'other', output: run.output }
  }
  if (run.exitCode === 1 && run.output.includes('No MCP server named')) {
    return { found: 'none' }
  }
  return { found: 'unknown', run }
}

const isExisting = (lookup: Lookup): lookup is Existing => lookup.found === 'ours' || lookup.found === 'other'

const reportExisting = (agent: NativeAgent, { found, output }: Existing): AgentMcpStatus => {
  if (found === 'ours') {
    log(`${agent.label} already has the Netlify MCP server.`)
    return 'present'
  }
  const where = output.includes(LEGACY_MCP_HOST) ? `the old host, ${LEGACY_MCP_HOST}` : 'a different URL'
  log(
    `${agent.label} has a ${chalk.cyan(NETLIFY_MCP_SERVER_NAME)} MCP server pointing at ${where}, so it was left unchanged.`,
  )
  if (agent.native.remove) {
    log(
      `  To switch to ${chalk.underline(NETLIFY_MCP_URL)}, run ${formatCommand(agent.binary, agent.native.remove)} then ${formatCommand(agent.binary, agent.native.add)}`,
    )
  }
  return 'kept'
}

const suggestNatively = async (
  agent: NativeAgent,
  env: NodeJS.ProcessEnv,
  workingDir: string,
): Promise<AgentMcpStatus> => {
  const executable = await findOnPath(agent.binary, env)
  if (executable && agent.native.lookup) {
    const existing = await lookUp(executable, agent.native.lookup, workingDir)
    if (isExisting(existing)) {
      return reportExisting(agent, existing)
    }
  }
  log(
    `To add the Netlify MCP server to ${agent.label} for your user, run ${formatCommand(agent.binary, agent.native.add)}`,
  )
  return 'printed'
}

const addNatively = async (agent: NativeAgent, env: NodeJS.ProcessEnv, workingDir: string): Promise<AgentMcpStatus> => {
  const { binary, native, label } = agent
  const executable = await findOnPath(binary, env)
  if (!executable) {
    return 'printed'
  }
  if (native.lookup) {
    const existing = await lookUp(executable, native.lookup, workingDir)
    if (existing.found === 'unknown') {
      warn(`Could not check ${label} for an existing Netlify MCP server: ${describeFailure(existing.run)}`)
      log(`  Add it yourself with ${formatCommand(binary, native.add)}`)
      return 'failed'
    }
    if (isExisting(existing)) {
      return reportExisting(agent, existing)
    }
  }

  const added = await runNative(executable, native.add, workingDir)
  if (added.missingBinary) {
    return 'printed'
  }
  if (added.exitCode !== 0) {
    warn(`Could not add the Netlify MCP server to ${label}: ${describeFailure(added)}`)
    log(`  Add it yourself with ${formatCommand(binary, native.add)}`)
    return 'failed'
  }
  log(`Added the Netlify MCP server to ${label} for your user. Nothing was written to the repository.`)
  if (native.remove) {
    log(`  Remove it with ${formatCommand(binary, native.remove)}`)
  }
  return 'added'
}

export interface McpChoiceStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

interface SavedChoice {
  url: string
  choice: 'accepted' | 'declined'
}

const SAVED_CHOICES_KEY = 'agentMcpSetup'

const savedChoiceKey = (agent: McpAgent): string => `${SAVED_CHOICES_KEY}.${agent.id}`

const savedChoice = (store: McpChoiceStore, agent: McpAgent): SavedChoice | undefined => {
  const saved = store.get(savedChoiceKey(agent)) as SavedChoice | undefined
  return saved?.url === NETLIFY_MCP_URL ? saved : undefined
}

const saveChoices = (
  store: McpChoiceStore,
  offered: McpAgent[],
  chosen: McpAgent[],
  statuses: Record<string, AgentMcpStatus>,
): void => {
  for (const agent of offered) {
    if (!chosen.includes(agent)) {
      store.set(savedChoiceKey(agent), { url: NETLIFY_MCP_URL, choice: 'declined' } satisfies SavedChoice)
    } else if (statuses[agent.id] !== 'failed') {
      store.set(savedChoiceKey(agent), { url: NETLIFY_MCP_URL, choice: 'accepted' } satisfies SavedChoice)
    }
  }
}

const loadGlobalStore = async (): Promise<McpChoiceStore> => await getGlobalConfigStore()

const resetHint = (): string =>
  `Run ${chalk.cyanBright.bold(`${netlifyCommand()} init --reset-mcp-setup`)} to choose again.`

type Selected =
  | { selection: 'driving'; agents: [McpAgent]; declined: boolean }
  | { selection: 'prompt'; agents: McpAgent[]; offered: McpAgent[]; store: McpChoiceStore }
  | { selection: 'saved' | 'none'; agents: [] }

const selectAgents = async ({
  workingDir,
  env,
  interactive,
  choose,
  reset,
  store,
}: {
  workingDir: string
  env: NodeJS.ProcessEnv
  interactive: boolean
  choose: ChooseAgents
  reset: boolean
  store: () => Promise<McpChoiceStore>
}): Promise<Selected> => {
  const drivingAgent = getDrivingAgent(env)
  if (drivingAgent) {
    const agent = MCP_AGENTS.find(({ drivenBy }) => drivenBy?.includes(drivingAgent.name))
    if (!agent) {
      return { selection: 'none', agents: [] }
    }
    const choices = await store()
    if (reset) {
      choices.set(savedChoiceKey(agent), undefined)
    }
    return { selection: 'driving', agents: [agent], declined: savedChoice(choices, agent)?.choice === 'declined' }
  }
  if (!interactive) {
    return { selection: 'none', agents: [] }
  }
  const candidates = await findCandidates(workingDir, env)
  if (candidates.length === 0) {
    return { selection: 'none', agents: [] }
  }
  const choices = await store()
  const undecided = reset ? candidates : candidates.filter(({ agent }) => !savedChoice(choices, agent))
  if (undecided.length === 0) {
    return { selection: 'saved', agents: [] }
  }
  return {
    selection: 'prompt',
    agents: await choose(undecided),
    offered: undecided.map(({ agent }) => agent),
    store: choices,
  }
}

export const setupAgentMcp = async ({
  workingDir,
  env = process.env,
  interactive = isInteractive(),
  choose = chooseWithPrompt,
  reset = false,
  store = loadGlobalStore,
}: {
  workingDir: string
  env?: NodeJS.ProcessEnv
  interactive?: boolean
  choose?: ChooseAgents
  reset?: boolean
  store?: () => Promise<McpChoiceStore>
}): Promise<AgentMcpSetupSummary> => {
  const summary: AgentMcpSetupSummary = { selection: 'none', agents: {} }
  try {
    const selected = await selectAgents({ workingDir, env, interactive, choose, reset, store })
    const { selection, agents } = selected
    summary.selection = selection
    if (selection === 'saved') {
      log(`Using your saved choices for the Netlify MCP server. ${resetHint()}`)
      return summary
    }
    if (selection === 'none') {
      log(`To add the Netlify MCP server to your AI agents, run ${chalk.cyanBright.bold(addMcpCommand([]))}`)
      return summary
    }

    if (selected.selection === 'driving') {
      const [agent] = selected.agents
      if (selected.declined) {
        log(`You chose not to add the Netlify MCP server to ${agent.label}. ${resetHint()}`)
        summary.agents[agent.id] = 'declined'
      } else if (hasNativeSetup(agent)) {
        summary.agents[agent.id] = await suggestNatively(agent, env, workingDir)
      } else {
        log(
          `To add the Netlify MCP server to ${agent.label} for your user, run ${chalk.cyanBright.bold(addMcpCommand([agent]))}`,
        )
        summary.agents[agent.id] = 'printed'
      }
      return summary
    }

    const toPrint: McpAgent[] = []
    for (const agent of agents) {
      const status = hasNativeSetup(agent) ? await addNatively(agent, env, workingDir) : 'printed'
      summary.agents[agent.id] = status
      if (status === 'printed') {
        toPrint.push(agent)
      }
    }
    if (toPrint.length > 0) {
      const labels = toPrint.map(({ label }) => label).join(', ')
      log(`To add the Netlify MCP server to ${labels}, run ${chalk.cyanBright.bold(addMcpCommand(toPrint))}`)
    }
    if (selected.selection === 'prompt') {
      saveChoices(selected.store, selected.offered, agents, summary.agents)
      log(`Your choices are saved for next time. ${resetHint()}`)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      throw error
    }
    warn(`Could not set up the Netlify MCP server: ${error instanceof Error ? error.message : String(error)}`)
    summary.failed = true
  }
  return summary
}
