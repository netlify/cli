import { constants as fsConstants, promises as fs } from 'node:fs'
import path from 'node:path'

import { checkbox } from '@inquirer/prompts'

import { type CanonicalAgentName, getDrivingAgent } from '../agent-detection.js'
import { chalk, log, warn } from '../command-helpers.js'
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

export type AgentMcpStatus = 'added' | 'present' | 'printed' | 'failed'
export type AgentSelection = 'driving' | 'prompt' | 'none'

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

const isOnPath = async (binary: string, env: NodeJS.ProcessEnv): Promise<boolean> => {
  const extensions = process.platform === 'win32' ? (env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : ['']
  const directories = (env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const found = await Promise.all(
    directories.flatMap((directory) =>
      extensions.map((extension) => isExecutableFile(path.join(directory, binary + extension))),
    ),
  )
  return found.includes(true)
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
    if (detected || (agent.binary !== undefined && (await isOnPath(agent.binary, env)))) {
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

const shellQuote = (arg: string): string => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`)

const formatCommand = (binary: string, args: string[]): string =>
  chalk.cyanBright.bold([binary, ...args].map(shellQuote).join(' '))

const runNative = async (binary: string, args: string[], cwd: string) => {
  const result = await execa(binary, args, { cwd, reject: false, timeout: NATIVE_TIMEOUT_MS })
  return {
    missingBinary: (result as { code?: string }).code === 'ENOENT',
    exitCode: result.exitCode,
    output: [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
    timedOut: result.timedOut,
  }
}

const describeFailure = ({ timedOut, output, exitCode }: Awaited<ReturnType<typeof runNative>>): string =>
  timedOut
    ? `timed out after ${(NATIVE_TIMEOUT_MS / 1000).toString()} seconds`
    : output || `exit code ${String(exitCode)}`

const addNatively = async (
  agent: McpAgent & { binary: string; native: NativeSetup },
  workingDir: string,
): Promise<AgentMcpStatus> => {
  const { binary, native, label } = agent
  if (native.lookup) {
    const existing = await runNative(binary, native.lookup, workingDir)
    if (existing.missingBinary) {
      return 'printed'
    }
    if (existing.exitCode === 0) {
      log(`${label} already has a ${chalk.cyan(NETLIFY_MCP_SERVER_NAME)} MCP server, so it was left unchanged.`)
      if (existing.output.includes(LEGACY_MCP_HOST)) {
        log(`  It points at ${LEGACY_MCP_HOST}. Netlify's MCP server now lives at ${chalk.underline(NETLIFY_MCP_URL)}`)
      }
      return 'present'
    }
    if (existing.exitCode !== 1 || !existing.output.includes('No MCP server named')) {
      warn(`Could not check ${label} for an existing Netlify MCP server: ${describeFailure(existing)}`)
      log(`  Add it yourself with ${formatCommand(binary, native.add)}`)
      return 'failed'
    }
  }

  const added = await runNative(binary, native.add, workingDir)
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

const hasNativeSetup = (agent: McpAgent): agent is McpAgent & { binary: string; native: NativeSetup } =>
  agent.binary !== undefined && agent.native !== undefined

const selectAgents = async ({
  workingDir,
  env,
  interactive,
  choose,
}: {
  workingDir: string
  env: NodeJS.ProcessEnv
  interactive: boolean
  choose: ChooseAgents
}): Promise<{ selection: AgentSelection; agents: McpAgent[] }> => {
  const drivingAgent = getDrivingAgent(env)
  if (drivingAgent) {
    const agent = MCP_AGENTS.find(({ drivenBy }) => drivenBy?.includes(drivingAgent.name))
    return agent ? { selection: 'driving', agents: [agent] } : { selection: 'none', agents: [] }
  }
  if (!interactive) {
    return { selection: 'none', agents: [] }
  }
  const candidates = await findCandidates(workingDir, env)
  if (candidates.length === 0) {
    return { selection: 'none', agents: [] }
  }
  return { selection: 'prompt', agents: await choose(candidates) }
}

export const setupAgentMcp = async ({
  workingDir,
  env = process.env,
  interactive = isInteractive(),
  choose = chooseWithPrompt,
}: {
  workingDir: string
  env?: NodeJS.ProcessEnv
  interactive?: boolean
  choose?: ChooseAgents
}): Promise<AgentMcpSetupSummary> => {
  const summary: AgentMcpSetupSummary = { selection: 'none', agents: {} }
  try {
    const { selection, agents } = await selectAgents({ workingDir, env, interactive, choose })
    summary.selection = selection
    if (selection === 'none') {
      log(`To add the Netlify MCP server to your AI agents, run ${chalk.cyanBright.bold(addMcpCommand([]))}`)
      return summary
    }

    const toPrint: McpAgent[] = []
    for (const agent of agents) {
      const status = hasNativeSetup(agent) ? await addNatively(agent, workingDir) : 'printed'
      summary.agents[agent.id] = status
      if (status === 'printed') {
        toPrint.push(agent)
      }
    }
    if (toPrint.length > 0) {
      const labels = toPrint.map(({ label }) => label).join(', ')
      log(`To add the Netlify MCP server to ${labels}, run ${chalk.cyanBright.bold(addMcpCommand(toPrint))}`)
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
