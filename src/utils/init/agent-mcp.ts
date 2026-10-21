import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'

import { checkbox } from '@inquirer/prompts'

import { type CanonicalAgentName, getDrivingAgent } from '../agent-detection.js'
import { chalk, log, netlifyCommand, warn } from '../command-helpers.js'
import execa from '../execa.js'
import { isInteractive } from '../scripted-commands.js'

export const NETLIFY_MCP_URL = 'https://mcp.netlify.com/mcp'
export const NETLIFY_MCP_SERVER_NAME = 'netlify'
const NETLIFY_MCP_HOSTS = new Set(['mcp.netlify.com', 'netlify-mcp.netlify.app'])
const NETLIFY_MCP_PACKAGE = '@netlify/mcp'
const NATIVE_TIMEOUT_MS = 15_000
const LIST_TIMEOUT_MS = 30_000
const ADD_MCP_VERSION = '2.4.1'

export const MCP_SCOPES = ['project', 'user'] as const
export type McpScope = (typeof MCP_SCOPES)[number]

interface NativeCommands {
  add: string[]
  remove?: string[]
  savedIn?: string
}

interface NativeSetup {
  lookup?: 'list' | 'get'
  scopes: Partial<Record<McpScope, NativeCommands>>
}

export interface McpAgent {
  id: string
  label: string
  binary?: string
  drivenBy?: CanonicalAgentName[]
  projectMarkers?: string[]
  projectFile?: string
  inTerminal?: (env: NodeJS.ProcessEnv) => boolean
  native?: NativeSetup
}

const inEditorTerminal = (env: NodeJS.ProcessEnv): boolean => env.TERM_PROGRAM === 'vscode'

const claudeAdd = (scope: string) => [
  'mcp',
  'add',
  '--transport',
  'http',
  '--scope',
  scope,
  NETLIFY_MCP_SERVER_NAME,
  NETLIFY_MCP_URL,
]

export const MCP_AGENTS: McpAgent[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    binary: 'claude',
    drivenBy: ['claude'],
    projectMarkers: ['.claude', '.mcp.json', 'CLAUDE.md'],
    projectFile: '.mcp.json',
    native: {
      lookup: 'list',
      scopes: {
        project: {
          add: claudeAdd('local'),
          remove: ['mcp', 'remove', '--scope', 'local', NETLIFY_MCP_SERVER_NAME],
          savedIn: "~/.claude.json, under this project's path",
        },
        user: {
          add: claudeAdd('user'),
          remove: ['mcp', 'remove', '--scope', 'user', NETLIFY_MCP_SERVER_NAME],
          savedIn: '~/.claude.json',
        },
      },
    },
  },
  {
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    drivenBy: ['codex'],
    projectMarkers: ['.codex'],
    projectFile: path.join('.codex', 'config.toml'),
    native: {
      lookup: 'get',
      scopes: {
        user: {
          add: ['mcp', 'add', NETLIFY_MCP_SERVER_NAME, '--url', NETLIFY_MCP_URL],
          remove: ['mcp', 'remove', NETLIFY_MCP_SERVER_NAME],
        },
      },
    },
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    binary: 'opencode',
    drivenBy: ['opencode'],
    projectMarkers: ['opencode.json', 'opencode.jsonc', '.opencode'],
    projectFile: 'opencode.jsonc',
    native: { scopes: { user: { add: ['mcp', 'add', NETLIFY_MCP_SERVER_NAME, '--url', NETLIFY_MCP_URL] } } },
  },
  {
    id: 'vscode',
    label: 'VS Code',
    binary: 'code',
    projectMarkers: [path.join('.vscode', 'mcp.json')],
    projectFile: path.join('.vscode', 'mcp.json'),
    inTerminal: (env) => inEditorTerminal(env) && !env.CURSOR_TRACE_ID,
    native: {
      scopes: {
        user: {
          add: ['--add-mcp', JSON.stringify({ name: NETLIFY_MCP_SERVER_NAME, type: 'http', url: NETLIFY_MCP_URL })],
        },
      },
    },
  },
  {
    id: 'cursor',
    label: 'Cursor',
    binary: 'cursor-agent',
    drivenBy: ['cursor'],
    projectMarkers: ['.cursor'],
    projectFile: path.join('.cursor', 'mcp.json'),
    inTerminal: (env) => inEditorTerminal(env) && Boolean(env.CURSOR_TRACE_ID),
  },
  { id: 'windsurf', label: 'Windsurf', binary: 'windsurf', projectMarkers: ['.windsurf'] },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    binary: 'gemini',
    drivenBy: ['gemini'],
    projectMarkers: ['.gemini', 'GEMINI.md'],
    projectFile: path.join('.gemini', 'settings.json'),
  },
  {
    id: 'github-copilot-cli',
    label: 'GitHub Copilot CLI',
    binary: 'copilot',
    drivenBy: ['copilot'],
    projectFile: '.mcp.json',
  },
  {
    id: 'kiro-cli',
    label: 'Kiro CLI',
    binary: 'kiro-cli',
    drivenBy: ['kiro'],
    projectMarkers: ['.kiro'],
    projectFile: path.join('.kiro', 'settings', 'mcp.json'),
  },
  { id: 'cline', label: 'Cline', drivenBy: ['cline'], projectMarkers: ['.clinerules'] },
]

export type AgentMcpStatus = 'added' | 'present' | 'kept' | 'printed' | 'declined' | 'failed'
export type AgentSelection = 'driving' | 'prompt' | 'saved' | 'none'

export interface AgentMcpSetupSummary {
  scope: McpScope
  selection: AgentSelection
  agents: Record<string, AgentMcpStatus>
  failed?: boolean
}

export interface AgentCandidate {
  agent: McpAgent
  detected: boolean
}

export type ChooseAgents = (candidates: AgentCandidate[]) => Promise<McpAgent[]>

const where = (scope: McpScope): string => (scope === 'project' ? 'this project' : 'all your projects')

const chooseWithPrompt =
  (scope: McpScope): ChooseAgents =>
  async (candidates) =>
    await checkbox({
      message: `Add the Netlify MCP server for ${where(scope)} to which AI agents?`,
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
  const pathExtensions = (env.PATHEXT ?? '').split(';').filter(Boolean)
  const extensions =
    process.platform === 'win32' ? (pathExtensions.length > 0 ? pathExtensions : ['.EXE', '.CMD', '.BAT']) : ['']
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

const parseUrl = (value: string): URL | undefined => {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

const urlsIn = (text: string): URL[] =>
  (text.match(/https?:\/\/[^\s"'<>]+/g) ?? []).map(parseUrl).filter((url): url is URL => url !== undefined)

const OUR_URL = new URL(NETLIFY_MCP_URL)

const isOurUrl = (url: URL): boolean =>
  url.protocol === OUR_URL.protocol &&
  url.hostname.toLowerCase() === OUR_URL.hostname &&
  url.pathname.replace(/\/$/, '') === OUR_URL.pathname

const pointsAtNetlify = (target: string): boolean =>
  urlsIn(target).some((url) => NETLIFY_MCP_HOSTS.has(url.hostname.toLowerCase())) ||
  target.split(/\s+/).some((word) => word === NETLIFY_MCP_PACKAGE || word.startsWith(`${NETLIFY_MCP_PACKAGE}@`))

const isNetlifyName = (name: string): boolean =>
  name === NETLIFY_MCP_SERVER_NAME || name.endsWith(`:${NETLIFY_MCP_SERVER_NAME}`)

const shellQuote = (arg: string): string => {
  if (process.platform === 'win32') {
    if (/^[\w@%+=:,./\\-]+$/.test(arg)) {
      return arg
    }
    return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
  }
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`
}

const formatCommand = (binary: string, args: string[]): string =>
  chalk.cyanBright.bold([binary, ...args].map(shellQuote).join(' '))

const addMcpArgs = (agents: McpAgent[], scope: McpScope): string[] => {
  const global = scope === 'user' || agents.some((agent) => agent.projectFile === undefined)
  return [
    '-y',
    `add-mcp@${ADD_MCP_VERSION}`,
    NETLIFY_MCP_URL,
    '--name',
    NETLIFY_MCP_SERVER_NAME,
    ...(global ? ['-g'] : []),
    ...(agents.length > 0 ? ['-y', ...agents.flatMap(({ id }) => ['-a', id])] : []),
  ]
}

const runNative = async (executable: string, args: string[], cwd: string, timeout = NATIVE_TIMEOUT_MS) => {
  const result = await execa(executable, args, { cwd, reject: false, stdin: 'ignore', timeout })
  return {
    exitCode: result.exitCode,
    output: [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
    stdout: result.stdout,
    timedOut: result.timedOut,
  }
}

type NativeRun = Awaited<ReturnType<typeof runNative>>

const describeFailure = ({ timedOut, output, exitCode }: NativeRun): string =>
  timedOut ? 'timed out' : output || `exit code ${String(exitCode)}`

type Existing = { found: 'ours' | 'other'; name: string }
type Lookup = Existing | { found: 'none' } | { found: 'unknown'; run: NativeRun }

const listedServers = (stdout: string): { name: string; target: string }[] =>
  stdout.split('\n').flatMap((line) => {
    const separator = line.indexOf(': ')
    if (separator <= 0) {
      return []
    }
    const status = line.lastIndexOf(' - ')
    const end = status > separator ? status : line.length
    return [{ name: line.slice(0, separator).trim(), target: line.slice(separator + 2, end).trim() }]
  })

const lookUp = async (executable: string, kind: 'list' | 'get', workingDir: string): Promise<Lookup> => {
  if (kind === 'list') {
    const run = await runNative(executable, ['mcp', 'list'], workingDir, LIST_TIMEOUT_MS)
    if (run.exitCode !== 0) {
      return { found: 'unknown', run }
    }
    const servers = listedServers(run.stdout)
    const ours = servers.find(({ target }) => urlsIn(target).some(isOurUrl))
    if (ours) {
      return { found: 'ours', name: ours.name }
    }
    const other = servers.find(({ name, target }) => isNetlifyName(name) || pointsAtNetlify(target))
    return other ? { found: 'other', name: other.name } : { found: 'none' }
  }
  const run = await runNative(executable, ['mcp', 'get', NETLIFY_MCP_SERVER_NAME], workingDir)
  if (run.exitCode === 0) {
    return { found: urlsIn(run.output).some(isOurUrl) ? 'ours' : 'other', name: NETLIFY_MCP_SERVER_NAME }
  }
  if (run.exitCode === 1 && run.output.includes('No MCP server named')) {
    return { found: 'none' }
  }
  return { found: 'unknown', run }
}

const isExisting = (lookup: Lookup): lookup is Existing => lookup.found === 'ours' || lookup.found === 'other'

const reportExisting = (agent: McpAgent, { found, name }: Existing): AgentMcpStatus => {
  if (found === 'ours') {
    log(`${agent.label} already has the Netlify MCP server.`)
    return 'present'
  }
  log(
    `${agent.label} already has a Netlify MCP server (${chalk.cyan(name)}) that isn't ${chalk.underline(NETLIFY_MCP_URL)}, so another one wasn't added.`,
  )
  log(`  To switch, remove ${chalk.cyan(name)} in ${agent.label} and run ${netlifyCommand()} init again.`)
  return 'kept'
}

const lookUpExisting = async (
  agent: McpAgent,
  env: NodeJS.ProcessEnv,
  workingDir: string,
): Promise<{ executable?: string; lookup?: Lookup }> => {
  if (agent.binary === undefined) {
    return {}
  }
  const executable = await findOnPath(agent.binary, env)
  const kind = agent.native?.lookup
  if (!executable || !kind) {
    return { executable }
  }
  return { executable, lookup: await lookUp(executable, kind, workingDir) }
}

const restartHint = (agent: McpAgent): string =>
  `  The Netlify MCP server loads the next time you start ${agent.label} in this folder.`

const commandFor = (agent: McpAgent, scope: McpScope): string => {
  const native = agent.native?.scopes[scope]
  if (native && agent.binary) {
    return formatCommand(agent.binary, native.add)
  }
  return formatCommand('npx', addMcpArgs([agent], scope))
}

const fileNote = (agent: McpAgent, scope: McpScope): string | undefined => {
  if (agent.native?.scopes[scope]) {
    return undefined
  }
  if (scope === 'project' && agent.projectFile === undefined) {
    return `  ${agent.label} has no per-project setting, so this adds it for all your projects.`
  }
  if (scope === 'project') {
    return `  This writes ${agent.projectFile ?? ''} in this folder. Commit it only if everyone on the project should get it.`
  }
  return undefined
}

const printCommand = (agent: McpAgent, scope: McpScope, lead: string): void => {
  log(`${lead} ${commandFor(agent, scope)}`)
  const note = fileNote(agent, scope)
  if (note) {
    log(note)
  }
  log(restartHint(agent))
}

const add = async (
  agent: McpAgent,
  scope: McpScope,
  env: NodeJS.ProcessEnv,
  workingDir: string,
): Promise<AgentMcpStatus> => {
  const commands = agent.native?.scopes[scope]
  const { executable, lookup } = await lookUpExisting(agent, env, workingDir)
  if (lookup?.found === 'unknown') {
    warn(`Could not check ${agent.label} for an existing Netlify MCP server: ${describeFailure(lookup.run)}`)
    printCommand(agent, scope, `  Add it yourself with`)
    return 'failed'
  }
  if (lookup && isExisting(lookup)) {
    return reportExisting(agent, lookup)
  }
  if (!commands || !executable || !agent.binary) {
    printCommand(agent, scope, `To add the Netlify MCP server to ${agent.label} for ${where(scope)}, run`)
    return 'printed'
  }

  const added = await runNative(executable, commands.add, workingDir)
  if (added.exitCode !== 0) {
    warn(`Could not add the Netlify MCP server to ${agent.label}: ${describeFailure(added)}`)
    log(`  Add it yourself with ${formatCommand(agent.binary, commands.add)}`)
    return 'failed'
  }
  const savedIn = commands.savedIn ? `Saved in ${commands.savedIn}; nothing` : 'Nothing'
  log(`Added the Netlify MCP server to ${agent.label} for ${where(scope)}. ${savedIn} was written to the repository.`)
  if (!agent.native?.lookup) {
    log(
      `  ${agent.label} can't be checked first, so this replaced any ${chalk.cyan(NETLIFY_MCP_SERVER_NAME)} server it had.`,
    )
  }
  if (commands.remove) {
    log(`  Remove it with ${formatCommand(agent.binary, commands.remove)}`)
  }
  log(restartHint(agent))
  return 'added'
}

export interface McpChoiceStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
}

interface SavedChoice {
  url: string
  scope: McpScope
  choice: 'accepted' | 'declined'
}

const SAVED_CHOICES_KEY = 'agentMcpSetup'

const savedChoiceKey = (agent: McpAgent): string => `${SAVED_CHOICES_KEY}.${agent.id}`

const savedChoice = (store: McpChoiceStore, agent: McpAgent, scope: McpScope): SavedChoice | undefined => {
  const saved = store.get(savedChoiceKey(agent)) as SavedChoice | undefined
  return saved?.url === NETLIFY_MCP_URL && saved.scope === scope ? saved : undefined
}

const saveChoices = (
  store: McpChoiceStore,
  scope: McpScope,
  offered: McpAgent[],
  chosen: McpAgent[],
  statuses: Record<string, AgentMcpStatus>,
): void => {
  for (const agent of offered) {
    if (!chosen.includes(agent)) {
      store.set(savedChoiceKey(agent), { url: NETLIFY_MCP_URL, scope, choice: 'declined' } satisfies SavedChoice)
    } else if (statuses[agent.id] !== 'failed' && statuses[agent.id] !== 'kept') {
      store.set(savedChoiceKey(agent), { url: NETLIFY_MCP_URL, scope, choice: 'accepted' } satisfies SavedChoice)
    }
  }
}

const resetHint = (): string =>
  `Run ${chalk.cyanBright.bold(`${netlifyCommand()} init --reset-mcp-setup`)} to choose again.`

type Selected =
  | { selection: 'driving'; agents: [McpAgent]; declined: boolean }
  | { selection: 'prompt'; agents: McpAgent[]; offered: McpAgent[] }
  | { selection: 'saved'; agents: [] }
  | { selection: 'none'; agents: [] }

const selectAgents = async ({
  workingDir,
  env,
  interactive,
  choose,
  reset,
  scope,
  store,
}: {
  workingDir: string
  env: NodeJS.ProcessEnv
  interactive: boolean
  choose: ChooseAgents
  reset: boolean
  scope: McpScope
  store: McpChoiceStore
}): Promise<Selected> => {
  const drivingAgent = getDrivingAgent(env)
  if (drivingAgent) {
    const agent = MCP_AGENTS.find(({ drivenBy }) => drivenBy?.includes(drivingAgent.name))
    if (!agent) {
      return { selection: 'none', agents: [] }
    }
    if (reset) {
      store.set(savedChoiceKey(agent), undefined)
    }
    return {
      selection: 'driving',
      agents: [agent],
      declined: savedChoice(store, agent, scope)?.choice === 'declined',
    }
  }
  if (!interactive) {
    return { selection: 'none', agents: [] }
  }
  const candidates = await findCandidates(workingDir, env)
  if (candidates.length === 0) {
    return { selection: 'none', agents: [] }
  }
  const undecided = reset ? candidates : candidates.filter(({ agent }) => !savedChoice(store, agent, scope))
  if (undecided.length === 0) {
    return { selection: 'saved', agents: [] }
  }
  return { selection: 'prompt', agents: await choose(undecided), offered: undecided.map(({ agent }) => agent) }
}

export const setupAgentMcp = async ({
  workingDir,
  store,
  scope = 'project',
  env = process.env,
  interactive = isInteractive(),
  choose = chooseWithPrompt(scope),
  reset = false,
}: {
  workingDir: string
  store: McpChoiceStore
  scope?: McpScope
  env?: NodeJS.ProcessEnv
  interactive?: boolean
  choose?: ChooseAgents
  reset?: boolean
}): Promise<AgentMcpSetupSummary> => {
  const summary: AgentMcpSetupSummary = { scope, selection: 'none', agents: {} }
  try {
    const selected = await selectAgents({ workingDir, env, interactive, choose, reset, scope, store })
    summary.selection = selected.selection
    if (selected.selection === 'saved') {
      log(`Using your saved choices for the Netlify MCP server. ${resetHint()}`)
      return summary
    }
    if (selected.selection === 'none') {
      log(`To add the Netlify MCP server to your AI agents, run ${formatCommand('npx', addMcpArgs([], scope))}`)
      return summary
    }

    if (selected.selection === 'driving') {
      const [agent] = selected.agents
      if (selected.declined) {
        log(`You chose not to add the Netlify MCP server to ${agent.label}. ${resetHint()}`)
        summary.agents[agent.id] = 'declined'
      } else {
        summary.agents[agent.id] = await add(agent, scope, env, workingDir)
      }
      return summary
    }

    for (const agent of selected.agents) {
      summary.agents[agent.id] = await add(agent, scope, env, workingDir)
    }
    saveChoices(store, scope, selected.offered, selected.agents, summary.agents)
    const toRun = selected.agents.filter(({ id }) => summary.agents[id] === 'printed')
    if (toRun.length > 0) {
      log(
        `Run the command shown for ${toRun.map(({ label }) => label).join(', ')} to finish. You won't be asked about ${toRun.length === 1 ? 'it' : 'them'} again in this project.`,
      )
    }
    log(`Your choices are saved for this project. ${resetHint()}`)
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      throw error
    }
    warn(`Could not set up the Netlify MCP server: ${error instanceof Error ? error.message : String(error)}`)
    summary.failed = true
  }
  return summary
}
