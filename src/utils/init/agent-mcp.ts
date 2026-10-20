import { chalk, log, warn } from '../command-helpers.js'
import execa from '../execa.js'

export const NETLIFY_MCP_URL = 'https://mcp.netlify.com/mcp'
export const NETLIFY_MCP_SERVER_NAME = 'netlify'
export const NETLIFY_MCP_DOCS_URL = 'https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/'
const LEGACY_MCP_HOST = 'netlify-mcp.netlify.app'

const CLAUDE_TIMEOUT_MS = 15_000

const ADD_ARGS = ['mcp', 'add', '--transport', 'http', '--scope', 'local', NETLIFY_MCP_SERVER_NAME, NETLIFY_MCP_URL]
const REMOVE_ARGS = ['mcp', 'remove', '--scope', 'local', NETLIFY_MCP_SERVER_NAME]

export type AgentMcpStatus = 'added' | 'present' | 'unavailable' | 'failed'

export interface AgentMcpSetupSummary {
  claudeCode: AgentMcpStatus
  error?: string
}

type ClaudeResult = { missing: true } | { missing: false; exitCode?: number; output: string; timedOut: boolean }

const runClaude = async (args: string[], cwd: string): Promise<ClaudeResult> => {
  const result = await execa('claude', args, { cwd, reject: false, timeout: CLAUDE_TIMEOUT_MS })
  if ((result as { code?: string }).code === 'ENOENT') {
    return { missing: true }
  }
  return {
    missing: false,
    exitCode: result.exitCode,
    output: [result.stderr, result.stdout].filter(Boolean).join('\n').trim(),
    timedOut: result.timedOut,
  }
}

const describeFailure = (result: Exclude<ClaudeResult, { missing: true }>): string =>
  result.timedOut
    ? `timed out after ${(CLAUDE_TIMEOUT_MS / 1000).toString()} seconds`
    : result.output || `exit code ${String(result.exitCode)}`

const command = (args: string[]): string => chalk.cyanBright.bold(['claude', ...args].join(' '))

const addToClaudeCode = async (workingDir: string): Promise<AgentMcpSetupSummary> => {
  const existing = await runClaude(['mcp', 'get', NETLIFY_MCP_SERVER_NAME], workingDir)
  if (existing.missing) {
    return { claudeCode: 'unavailable' }
  }
  if (existing.exitCode === 0) {
    log(`Claude Code already has a ${chalk.cyan(NETLIFY_MCP_SERVER_NAME)} MCP server, so it was left unchanged.`)
    if (existing.output.includes(LEGACY_MCP_HOST)) {
      log(`  It points at ${LEGACY_MCP_HOST}. Netlify's MCP server now lives at ${chalk.underline(NETLIFY_MCP_URL)}`)
    }
    return { claudeCode: 'present' }
  }
  if (existing.exitCode !== 1 || !existing.output.includes('No MCP server named')) {
    return { claudeCode: 'failed', error: describeFailure(existing) }
  }

  const added = await runClaude(ADD_ARGS, workingDir)
  if (added.missing) {
    return { claudeCode: 'unavailable' }
  }
  if (added.exitCode !== 0) {
    return { claudeCode: 'failed', error: describeFailure(added) }
  }
  log(`Added the Netlify MCP server to Claude Code for you in this project. Nothing was written to the repository.`)
  log(`  Remove it with ${command(REMOVE_ARGS)}`)
  return { claudeCode: 'added' }
}

export const setupAgentMcp = async ({ workingDir }: { workingDir: string }): Promise<AgentMcpSetupSummary> => {
  let summary: AgentMcpSetupSummary
  try {
    summary = await addToClaudeCode(workingDir)
  } catch (error) {
    summary = { claudeCode: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
  if (summary.claudeCode === 'failed') {
    warn(`Could not add the Netlify MCP server to Claude Code: ${summary.error ?? 'unknown error'}`)
    log(`  Add it yourself with ${command(ADD_ARGS)}`)
  }
  log(`To connect other AI agents to the Netlify MCP server, see ${chalk.underline(NETLIFY_MCP_DOCS_URL)}`)
  return summary
}
