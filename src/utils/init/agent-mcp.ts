import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { checkbox } from '@inquirer/prompts'
import { isexe } from 'isexe'

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

type LookupKind = 'list' | 'list-json'

interface NativeCommands {
  add: string[]
  remove?: string[]
  savedIn?: string
}

interface NativeSetup {
  lookup?: LookupKind
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
      lookup: 'list-json',
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

export type AgentMcpStatus = 'added' | 'present' | 'kept' | 'printed' | 'unsupported' | 'declined' | 'failed'
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

const findOnPath = async (binary: string, env: NodeJS.ProcessEnv): Promise<string | undefined> => {
  const pathExtensions = (env.PATHEXT ?? '').split(';').filter(Boolean)
  const extensions =
    process.platform === 'win32' ? (pathExtensions.length > 0 ? pathExtensions : ['.EXE', '.CMD', '.BAT']) : ['']
  const isExecutableFile = (target: string) => isexe(target, { ignoreErrors: true, pathExt: extensions.join(';') })
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

const supportsScope = (agent: McpAgent, scope: McpScope): boolean =>
  scope === 'user' || agent.projectFile !== undefined || agent.native?.scopes.project !== undefined

export const findCandidates = async (
  workingDir: string,
  env: NodeJS.ProcessEnv,
  scope: McpScope = 'project',
): Promise<AgentCandidate[]> => {
  const candidates: AgentCandidate[] = []
  for (const agent of MCP_AGENTS.filter((candidate) => supportsScope(candidate, scope))) {
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
  url.username === '' &&
  url.password === '' &&
  url.hostname.toLowerCase() === OUR_URL.hostname &&
  url.port === OUR_URL.port &&
  url.pathname.replace(/\/$/, '') === OUR_URL.pathname &&
  url.search === '' &&
  url.hash === ''

const pointsAtNetlify = (target: string): boolean =>
  urlsIn(target).some((url) => NETLIFY_MCP_HOSTS.has(url.hostname.toLowerCase())) ||
  target.split(/\s+/).some((word) => word === NETLIFY_MCP_PACKAGE || word.startsWith(`${NETLIFY_MCP_PACKAGE}@`))

const isNetlifyName = (name: string): boolean =>
  name === NETLIFY_MCP_SERVER_NAME || name.endsWith(`:${NETLIFY_MCP_SERVER_NAME}`)

const isControlCharacter = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

const printable = (text: string): string =>
  Array.from(text)
    .filter((character) => !isControlCharacter(character))
    .join('')

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
  const global = scope === 'user'
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
  timedOut ? 'timed out' : output.split('\n').map(printable).join('\n') || `exit code ${String(exitCode)}`

type Existing = { found: 'ours' | 'other'; name: string }
type Lookup = Existing | { found: 'none' } | { found: 'unknown'; run: NativeRun }

const PENDING_APPROVAL = 'Pending approval'
const USER_SCOPE_DETAIL = /^\s*Scope: User config\b/m

const listedServers = (stdout: string): { name: string; target: string }[] =>
  stdout.split('\n').flatMap((line) => {
    const separator = line.indexOf(': ')
    if (separator <= 0) {
      return []
    }
    const status = line.lastIndexOf(' - ')
    const end = status > separator ? status : line.length
    if (line.slice(end).includes(PENDING_APPROVAL)) {
      return []
    }
    return [{ name: line.slice(0, separator).trim(), target: line.slice(separator + 2, end).trim() }]
  })

interface CodexServer {
  name?: unknown
  transport?: { url?: unknown; command?: unknown; args?: unknown }
}

const codexServers = (stdout: string): { name: string; target: string }[] | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout)
    if (!Array.isArray(parsed)) {
      return undefined
    }
    return (parsed as CodexServer[]).map(({ name, transport }) => ({
      name: typeof name === 'string' ? name : '',
      target: [
        transport?.url,
        transport?.command,
        ...(Array.isArray(transport?.args) ? (transport.args as unknown[]) : []),
      ]
        .filter((part): part is string => typeof part === 'string')
        .join(' '),
    }))
  } catch {
    return undefined
  }
}

const classify = (servers: { name: string; target: string }[]): Lookup => {
  const ours = servers.find(({ target }) => urlsIn(target).some(isOurUrl))
  if (ours) {
    return { found: 'ours', name: ours.name }
  }
  const other = servers.find(({ name, target }) => isNetlifyName(name) || pointsAtNetlify(target))
  return other ? { found: 'other', name: other.name } : { found: 'none' }
}

const isExisting = (lookup: Lookup): lookup is Existing => lookup.found === 'ours' || lookup.found === 'other'

const lookUpAtUserScope = async (executable: string, lookup: Lookup, workingDir: string): Promise<Lookup> => {
  if (!isExisting(lookup) || lookup.name.startsWith('plugin:')) {
    return lookup
  }
  const details = await runNative(executable, ['mcp', 'get', lookup.name], workingDir, LIST_TIMEOUT_MS)
  if (details.exitCode !== 0) {
    return { found: 'unknown', run: details }
  }
  return USER_SCOPE_DETAIL.test(details.stdout) ? lookup : { found: 'none' }
}

const lookUp = async (executable: string, kind: LookupKind, workingDir: string, scope: McpScope): Promise<Lookup> => {
  if (kind === 'list-json') {
    const run = await runNative(executable, ['mcp', 'list', '--json'], scope === 'user' ? homedir() : workingDir)
    const servers = run.exitCode === 0 ? codexServers(run.stdout) : undefined
    return servers ? classify(servers) : { found: 'unknown', run }
  }
  const run = await runNative(executable, ['mcp', 'list'], workingDir, LIST_TIMEOUT_MS)
  if (run.exitCode !== 0) {
    return { found: 'unknown', run }
  }
  const lookup = classify(listedServers(run.stdout))
  return scope === 'user' ? await lookUpAtUserScope(executable, lookup, workingDir) : lookup
}

const reportExisting = (agent: McpAgent, { found, name }: Existing): AgentMcpStatus => {
  if (found === 'ours') {
    log(`${agent.label} already has the Netlify MCP server.`)
    return 'present'
  }
  log(
    `${agent.label} already has a Netlify MCP server (${chalk.cyan(printable(name))}) that isn't ${chalk.underline(NETLIFY_MCP_URL)}, so another one wasn't added.`,
  )
  log(
    `  To switch, remove ${chalk.cyan(printable(name))} in ${agent.label} and run ${chalk.cyanBright.bold(`${netlifyCommand()} init --reset-mcp-setup`)}`,
  )
  return 'kept'
}

const lookUpExisting = async (
  agent: McpAgent,
  env: NodeJS.ProcessEnv,
  workingDir: string,
  scope: McpScope,
): Promise<{ executable?: string; lookup?: Lookup }> => {
  if (agent.binary === undefined) {
    return {}
  }
  const executable = await findOnPath(agent.binary, env)
  const kind = agent.native?.lookup
  if (!executable || !kind) {
    return { executable }
  }
  return { executable, lookup: await lookUp(executable, kind, workingDir, scope) }
}

const restartHint = (agent: McpAgent, scope: McpScope): string =>
  `  The Netlify MCP server loads the next time you start ${agent.label}${scope === 'project' ? ' in this folder' : ''}.`

const commandFor = (agent: McpAgent, scope: McpScope): string => {
  const native = agent.native?.scopes[scope]
  if (native && agent.binary) {
    return formatCommand(agent.binary, native.add)
  }
  return formatCommand('npx', addMcpArgs([agent], scope))
}

const fileNote = (agent: McpAgent, scope: McpScope): string | undefined => {
  const native = agent.native?.scopes[scope]
  if (native && !agent.native?.lookup) {
    return `  Running it replaces any ${chalk.cyan(NETLIFY_MCP_SERVER_NAME)} server ${agent.label} already has.`
  }
  if (native) {
    return undefined
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
  log(restartHint(agent, scope))
}

const add = async (
  agent: McpAgent,
  scope: McpScope,
  env: NodeJS.ProcessEnv,
  workingDir: string,
): Promise<AgentMcpStatus> => {
  if (!supportsScope(agent, scope)) {
    log(
      `${agent.label} has no per-project MCP setting, so nothing was set up. To add the Netlify MCP server for all your projects, run ${chalk.cyanBright.bold(`${netlifyCommand()} init --mcp-scope user`)}`,
    )
    return 'unsupported'
  }
  const commands = agent.native?.scopes[scope]
  const { executable, lookup } = await lookUpExisting(agent, env, workingDir, scope)
  if (lookup?.found === 'unknown') {
    warn(`Could not check ${agent.label} for an existing Netlify MCP server: ${describeFailure(lookup.run)}`)
    printCommand(agent, scope, `  Add it yourself with`)
    return 'failed'
  }
  if (lookup && isExisting(lookup)) {
    return reportExisting(agent, lookup)
  }
  if (!commands || !executable || !agent.binary || !agent.native?.lookup) {
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
  if (commands.remove) {
    log(`  Remove it with ${formatCommand(agent.binary, commands.remove)}`)
  }
  log(restartHint(agent, scope))
  return 'added'
}

export interface McpChoiceStore {
  get(key: string): unknown
  set(key: string, value: unknown): void
  delete(key: string): void
}

interface SavedChoice {
  url: string
  choice: 'accepted' | 'declined' | 'kept'
}

const SAVED_CHOICES_KEY = 'agentMcpSetup'

const savedChoiceKey = (agent: McpAgent, scope: McpScope): string => `${SAVED_CHOICES_KEY}.${scope}.${agent.id}`

const savedChoice = (store: McpChoiceStore, agent: McpAgent, scope: McpScope): SavedChoice | undefined => {
  const saved = store.get(savedChoiceKey(agent, scope)) as SavedChoice | undefined
  return saved?.url === NETLIFY_MCP_URL ? saved : undefined
}

const saveChoice = (store: McpChoiceStore, agent: McpAgent, scope: McpScope, status: AgentMcpStatus): void => {
  if (status === 'failed') {
    if (store.get(savedChoiceKey(agent, scope)) !== undefined) {
      store.delete(savedChoiceKey(agent, scope))
    }
    return
  }
  const choice: SavedChoice['choice'] = status === 'declined' ? 'declined' : status === 'kept' ? 'kept' : 'accepted'
  store.set(savedChoiceKey(agent, scope), { url: NETLIFY_MCP_URL, choice } satisfies SavedChoice)
}

const saveChoices = (
  store: McpChoiceStore,
  scope: McpScope,
  offered: McpAgent[],
  chosen: McpAgent[],
  statuses: Record<string, AgentMcpStatus>,
): void => {
  for (const agent of offered) {
    saveChoice(store, agent, scope, chosen.includes(agent) ? statuses[agent.id] : 'declined')
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
  const agent = drivingAgent && MCP_AGENTS.find(({ drivenBy }) => drivenBy?.includes(drivingAgent.name))
  if (agent) {
    return {
      selection: 'driving',
      agents: [agent],
      declined: !reset && savedChoice(store, agent, scope)?.choice === 'declined',
    }
  }
  if (!interactive) {
    return { selection: 'none', agents: [] }
  }
  const candidates = await findCandidates(workingDir, env, scope)
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
      log(
        `  It asks which agents to set up. To skip the questions, add ${chalk.cyan('-y -a <agent>')}; ${formatCommand('npx', [`add-mcp@${ADD_MCP_VERSION}`, 'list-agents'])} shows the agent names.`,
      )
      return summary
    }

    if (selected.selection === 'driving') {
      const [agent] = selected.agents
      if (selected.declined) {
        log(`You chose not to add the Netlify MCP server to ${agent.label}. ${resetHint()}`)
        summary.agents[agent.id] = 'declined'
      } else {
        const status = await add(agent, scope, env, workingDir)
        summary.agents[agent.id] = status
        const installed = status === 'added' || status === 'present' || status === 'kept'
        if (reset && installed && savedChoice(store, agent, scope)) {
          saveChoice(store, agent, scope, status)
        }
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
