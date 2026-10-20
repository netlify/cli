import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { log, warn } from '../../../../src/utils/command-helpers.js'
import execa from '../../../../src/utils/execa.js'
import {
  type AgentCandidate,
  type ChooseAgents,
  type McpChoiceStore,
  NETLIFY_MCP_URL,
  findCandidates,
  setupAgentMcp,
} from '../../../../src/utils/init/agent-mcp.js'

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  log: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../../../../src/utils/execa.js', () => ({ default: vi.fn() }))

const execaMock = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>

const exited = (exitCode: number, stderr = '', stdout = '') => ({ exitCode, stdout, stderr, timedOut: false })
const missingServer = () => exited(1, 'No MCP server named "netlify"')
const notInstalled = () => ({ code: 'ENOENT', exitCode: undefined, stdout: '', stderr: '', timedOut: false })
const timedOut = () => ({ exitCode: undefined, stdout: '', stderr: '', timedOut: true })

const CLAUDE_ADD = ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'netlify', NETLIFY_MCP_URL]
const CODEX_ADD = ['mcp', 'add', 'netlify', '--url', NETLIFY_MCP_URL]

const logged = () =>
  vi
    .mocked(log)
    .mock.calls.map(([message]) => message)
    .join('\n')
const warned = () =>
  vi
    .mocked(warn)
    .mock.calls.map(([message]) => message)
    .join('\n')

const neverChoose = vi.fn<ChooseAgents>(() => Promise.reject(new Error('prompt should not open')))

describe('setupAgentMcp', () => {
  let root: string
  let project: string
  let bin: string
  let saved: Map<string, unknown>

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'netlify-agent-mcp-'))
    project = join(root, 'project')
    bin = join(root, 'bin')
    await mkdir(project)
    await mkdir(bin)
    saved = new Map()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  const install = async (...binaries: string[]) => {
    for (const binary of binaries) {
      const file = join(bin, process.platform === 'win32' ? `${binary}.cmd` : binary)
      await writeFile(file, '')
      await chmod(file, 0o755)
    }
  }

  const store = (): Promise<McpChoiceStore> =>
    Promise.resolve({ get: (key) => saved.get(key), set: (key, value) => saved.set(key, value) })

  const run = (
    env: NodeJS.ProcessEnv,
    options: { interactive?: boolean; choose?: ChooseAgents; reset?: boolean } = {},
  ) =>
    setupAgentMcp({
      workingDir: project,
      env: { PATH: bin, ...env },
      interactive: options.interactive ?? false,
      choose: options.choose ?? neverChoose,
      reset: options.reset ?? false,
      store,
    })

  const chooseIds = (...ids: string[]) =>
    vi.fn<ChooseAgents>((candidates) =>
      Promise.resolve(candidates.map(({ agent }) => agent).filter(({ id }) => ids.includes(id))),
    )

  const offeredIds = (choose: ReturnType<typeof chooseIds>, call = 0) =>
    choose.mock.calls[call][0].map(({ agent }) => agent.id)

  describe('when an agent runs init', () => {
    test('adds the server to that agent at user scope, without a prompt', async () => {
      execaMock.mockResolvedValueOnce(missingServer()).mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { interactive: true })).resolves.toEqual({
        selection: 'driving',
        agents: { 'claude-code': 'added' },
      })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(execaMock).toHaveBeenNthCalledWith(
        1,
        'claude',
        ['mcp', 'get', 'netlify'],
        expect.objectContaining({ cwd: project, reject: false }),
      )
      expect(execaMock).toHaveBeenNthCalledWith(2, 'claude', CLAUDE_ADD, expect.objectContaining({ cwd: project }))
      expect(logged()).toContain('claude mcp remove --scope user netlify')
    })

    test('uses the Codex CLI when Codex runs init', async () => {
      execaMock
        .mockResolvedValueOnce(exited(1, "Error: No MCP server named 'netlify' found."))
        .mockResolvedValueOnce(exited(0))

      await expect(run({ CODEX_CI: '1' })).resolves.toEqual({ selection: 'driving', agents: { codex: 'added' } })

      expect(execaMock).toHaveBeenNthCalledWith(2, 'codex', CODEX_ADD, expect.anything())
    })

    test('leaves an existing server alone and points an old-host entry at the new one', async () => {
      execaMock.mockResolvedValueOnce(exited(0, '', 'URL: https://netlify-mcp.netlify.app/mcp'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toEqual({
        selection: 'driving',
        agents: { 'claude-code': 'present' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
      expect(logged()).toContain('already has a netlify MCP server')
      expect(logged()).toContain(`now lives at ${NETLIFY_MCP_URL}`)
    })

    test('prints an add-mcp command for an agent without its own add command', async () => {
      await expect(run({ GEMINI_CLI: '1' })).resolves.toEqual({
        selection: 'driving',
        agents: { 'gemini-cli': 'printed' },
      })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain(`npx -y add-mcp@2.4.1 ${NETLIFY_MCP_URL} --name netlify -g -a gemini-cli`)
    })

    test('falls back to the add-mcp command when the agent CLI is not on PATH', async () => {
      execaMock.mockResolvedValueOnce(notInstalled())

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toEqual({
        selection: 'driving',
        agents: { 'claude-code': 'printed' },
      })

      expect(logged()).toContain('-a claude-code')
      expect(warn).not.toHaveBeenCalled()
    })

    test('does not add when the lookup fails for a reason other than a missing server', async () => {
      execaMock.mockResolvedValueOnce(exited(1, 'Failed to connect'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toEqual({
        selection: 'driving',
        agents: { 'claude-code': 'failed' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
      expect(warned()).toContain('Failed to connect')
      expect(logged()).toContain(`claude ${CLAUDE_ADD.join(' ')}`)
    })

    test('does not add when the lookup times out', async () => {
      execaMock.mockResolvedValueOnce(timedOut())

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
      expect(warned()).toContain('timed out')
    })

    test('reports a failed add with the command to run by hand', async () => {
      execaMock.mockResolvedValueOnce(missingServer()).mockResolvedValueOnce(exited(1, 'boom'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(warned()).toContain('boom')
    })

    test('prints the generic command for an agent it has no mapping for', async () => {
      await expect(run({ AGENT: 'amp' }, { interactive: true })).resolves.toEqual({ selection: 'none', agents: {} })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(logged()).toContain(`npx -y add-mcp@2.4.1 ${NETLIFY_MCP_URL} --name netlify -g`)
    })
  })

  describe('when a person runs init', () => {
    test('offers detected agents preticked and installed ones unticked, then adds the chosen ones', async () => {
      await mkdir(join(project, '.cursor'))
      await install('code', 'codex')
      execaMock.mockResolvedValueOnce(exited(0))
      const choose = vi.fn((candidates: AgentCandidate[]) =>
        Promise.resolve(candidates.filter(({ agent }) => agent.id !== 'codex').map(({ agent }) => agent)),
      )

      await expect(run({ TERM_PROGRAM: 'vscode' }, { interactive: true, choose })).resolves.toEqual({
        selection: 'prompt',
        agents: { vscode: 'added', cursor: 'printed' },
      })

      expect(choose.mock.calls[0][0].map(({ agent, detected }) => [agent.id, detected])).toEqual([
        ['vscode', true],
        ['cursor', true],
        ['codex', false],
      ])
      expect(execaMock).toHaveBeenCalledWith(
        'code',
        ['--add-mcp', JSON.stringify({ name: 'netlify', type: 'http', url: NETLIFY_MCP_URL })],
        expect.anything(),
      )
      expect(logged()).toContain('-a cursor')
    })

    test('adds nothing when the person unticks every agent', async () => {
      await install('claude')

      await expect(run({}, { interactive: true, choose: vi.fn(() => Promise.resolve([])) })).resolves.toEqual({
        selection: 'prompt',
        agents: {},
      })

      expect(execaMock).not.toHaveBeenCalled()
    })

    test('rethrows a cancelled prompt so init stops like any other prompt', async () => {
      await install('claude')
      const cancelled = Object.assign(new Error('User force closed the prompt'), { name: 'ExitPromptError' })

      await expect(run({}, { interactive: true, choose: vi.fn(() => Promise.reject(cancelled)) })).rejects.toBe(
        cancelled,
      )
    })

    test('prints the generic command without a prompt when no terminal is attached', async () => {
      await install('claude')

      await expect(run({})).resolves.toEqual({ selection: 'none', agents: {} })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(execaMock).not.toHaveBeenCalled()
    })
  })

  describe('saved choices', () => {
    test('remembers both a yes and a no, so the next run does not prompt', async () => {
      await install('claude', 'codex')
      execaMock.mockResolvedValueOnce(missingServer()).mockResolvedValueOnce(exited(0))
      const choose = chooseIds('claude-code')

      await run({}, { interactive: true, choose })
      expect(offeredIds(choose)).toEqual(['claude-code', 'codex'])
      expect(logged()).toContain('init --reset-mcp-setup')

      await expect(run({}, { interactive: true })).resolves.toEqual({ selection: 'saved', agents: {} })
      expect(neverChoose).not.toHaveBeenCalled()
      expect(execaMock).toHaveBeenCalledTimes(2)
      expect(logged()).toContain('Using your saved choices')
    })

    test('asks only about an agent installed since the last run', async () => {
      await install('codex')
      await run({}, { interactive: true, choose: chooseIds() })
      await install('opencode')
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['opencode'])
    })

    test('--reset-mcp-setup asks about every agent again', async () => {
      await install('codex')
      await run({}, { interactive: true, choose: chooseIds() })
      const choose = chooseIds()

      await run({}, { interactive: true, choose, reset: true })

      expect(offeredIds(choose)).toEqual(['codex'])
    })

    test('does not save a yes whose add failed, so it is offered again', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(missingServer()).mockResolvedValueOnce(exited(1, 'boom'))
      await run({}, { interactive: true, choose: chooseIds('claude-code') })
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['claude-code'])
    })

    test('offers an agent again when its saved choice was for a different server URL', async () => {
      await install('codex')
      saved.set('agentMcpSetup.codex', { url: 'https://netlify-mcp.netlify.app/mcp', choice: 'declined' })
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['codex'])
      expect(saved.get('agentMcpSetup.codex')).toEqual({ url: NETLIFY_MCP_URL, choice: 'declined' })
    })

    test('leaves saved choices alone when an agent runs init', async () => {
      execaMock.mockResolvedValueOnce(exited(0))

      await run({ NETLIFY_AGENT: 'claude-code' })

      expect(saved.size).toBe(0)
    })
  })

  describe('findCandidates', () => {
    test('tells Cursor terminals apart from VS Code ones', async () => {
      const candidates = await findCandidates(project, { PATH: bin, TERM_PROGRAM: 'vscode', CURSOR_TRACE_ID: 'x' })

      expect(candidates.map(({ agent }) => agent.id)).toEqual(['cursor'])
    })

    test('finds nothing in a plain terminal with no agent folders or CLIs', async () => {
      await expect(findCandidates(project, { PATH: bin })).resolves.toEqual([])
    })
  })
})
