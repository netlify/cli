import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { log, warn } from '../../../../src/utils/command-helpers.js'
import execa from '../../../../src/utils/execa.js'
import {
  type ChooseAgents,
  type McpChoiceStore,
  type McpScope,
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
const listed = (...lines: string[]) => exited(0, '', ['Checking MCP server health…', '', ...lines].join('\n'))
const timedOut = () => ({ exitCode: undefined, stdout: '', stderr: '', timedOut: true })

const OURS_LINE = `netlify: ${NETLIFY_MCP_URL} (HTTP) - ✔ Connected`
const LOCAL_LINE = 'netlify: npx -y @netlify/mcp - ✔ Connected'
const LEGACY_PLUGIN_LINE = 'plugin:netlify:netlify: https://netlify-mcp.netlify.app/mcp (HTTP) - ✔ Connected'
const UNRELATED_LINE = 'netliray: https://netliray.netlify.app/mcp (HTTP) - ✘ Failed to connect'

const claudeAdd = (scope: string) => ['mcp', 'add', '--transport', 'http', '--scope', scope, 'netlify', NETLIFY_MCP_URL]
const ADD_MCP = `npx -y add-mcp@2.4.1 ${NETLIFY_MCP_URL} --name netlify`

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

const executableName = (binary: string) => (process.platform === 'win32' ? `${binary}.cmd` : binary)

describe('setupAgentMcp', () => {
  let root: string
  let project: string
  let bin: string
  let saved: Map<string, unknown>
  let store: McpChoiceStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'netlify-agent-mcp-'))
    project = join(root, 'project')
    bin = join(root, 'bin')
    await mkdir(project)
    await mkdir(bin)
    saved = new Map()
    store = { get: (key) => saved.get(key), set: (key, value) => saved.set(key, value) }
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await rm(root, { recursive: true, force: true })
  })

  const install = async (...binaries: string[]) => {
    for (const binary of binaries) {
      const file = join(bin, executableName(binary))
      await writeFile(file, '')
      await chmod(file, 0o755)
    }
  }

  const installed = (binary: string) => join(bin, executableName(binary))

  const run = (
    env: NodeJS.ProcessEnv,
    options: { interactive?: boolean; choose?: ChooseAgents; reset?: boolean; path?: string; scope?: McpScope } = {},
  ) =>
    setupAgentMcp({
      workingDir: project,
      store,
      scope: options.scope ?? 'project',
      env: { PATH: options.path ?? bin, ...env },
      interactive: options.interactive ?? false,
      choose: options.choose ?? neverChoose,
      reset: options.reset ?? false,
    })

  const chooseIds = (...ids: string[]) =>
    vi.fn<ChooseAgents>((candidates) =>
      Promise.resolve(candidates.map(({ agent }) => agent).filter(({ id }) => ids.includes(id))),
    )

  const offeredIds = (choose: ReturnType<typeof chooseIds>, call = 0) =>
    choose.mock.calls[call][0].map(({ agent }) => agent.id)

  describe('when an agent runs init', () => {
    test('installs Claude for this project only, without a prompt, after checking every scope', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(UNRELATED_LINE)).mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { interactive: true })).resolves.toEqual({
        scope: 'project',
        selection: 'driving',
        agents: { 'claude-code': 'added' },
      })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(execaMock).toHaveBeenNthCalledWith(
        1,
        installed('claude'),
        ['mcp', 'list'],
        expect.objectContaining({ cwd: project, reject: false, stdin: 'ignore' }),
      )
      expect(execaMock).toHaveBeenNthCalledWith(2, installed('claude'), claudeAdd('local'), expect.anything())
      expect(logged()).toContain('claude mcp remove --scope local netlify')
      expect(logged()).toContain('loads the next time you start Claude Code in this folder')
    })

    test('installs user-wide only when --mcp-scope user is passed', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })

      expect(execaMock).toHaveBeenNthCalledWith(2, installed('claude'), claudeAdd('user'), expect.anything())
    })

    test('prints a project add-mcp command for Codex, naming the file it writes', async () => {
      await install('codex')
      execaMock.mockResolvedValueOnce(exited(1, "Error: No MCP server named 'netlify' found."))

      await expect(run({ CODEX_CI: '1' })).resolves.toMatchObject({ agents: { codex: 'printed' } })

      expect(logged()).toContain(`${ADD_MCP} -y -a codex`)
      expect(logged()).not.toContain(' -g')
      expect(logged()).toContain(join('.codex', 'config.toml'))
    })

    test('runs the Codex CLI when the scope is user', async () => {
      await install('codex')
      execaMock
        .mockResolvedValueOnce(exited(1, "Error: No MCP server named 'netlify' found."))
        .mockResolvedValueOnce(exited(0))

      await expect(run({ CODEX_CI: '1' }, { scope: 'user' })).resolves.toMatchObject({ agents: { codex: 'added' } })

      expect(execaMock).toHaveBeenNthCalledWith(
        2,
        installed('codex'),
        ['mcp', 'add', 'netlify', '--url', NETLIFY_MCP_URL],
        expect.anything(),
      )
    })

    test('says nothing needs doing when the hosted server is already set up at any scope', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(UNRELATED_LINE, OURS_LINE))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'present' },
      })

      expect(logged()).toContain('already has the Netlify MCP server')
      expect(logged()).not.toContain('mcp add')
    })

    test.each([
      ['a local npx server', LOCAL_LINE, 'netlify'],
      ['a plugin server on the old host', LEGACY_PLUGIN_LINE, 'plugin:netlify:netlify'],
    ])('leaves %s alone instead of adding a second one', async (_, line, name) => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(line))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'kept' },
      })

      expect(logged()).toContain(name)
      expect(logged()).not.toContain('mcp add')
    })

    test('reads older claude mcp list output that has no health status', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(`netlify: ${NETLIFY_MCP_URL} (HTTP)`))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'present' },
      })
    })

    test('does not treat a URL that only contains the hosted URL as the hosted server', async () => {
      await install('claude')
      execaMock
        .mockResolvedValueOnce(listed(`evil: https://evil.example/${NETLIFY_MCP_URL} (HTTP) - ✔ Connected`))
        .mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })
    })

    test('prints add-mcp for Gemini CLI without running anything', async () => {
      await expect(run({ GEMINI_CLI: '1' })).resolves.toMatchObject({ agents: { 'gemini-cli': 'printed' } })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain(`${ADD_MCP} -y -a gemini-cli`)
    })

    test('uses a user-wide command for an agent with no per-project setting, and says so', async () => {
      await run({ CLINE_ACTIVE: 'true' })

      expect(logged()).toContain(`${ADD_MCP} -g -y -a cline`)
      expect(logged()).toContain('has no per-project setting')
    })

    test('prints the command without a lookup when the agent CLI is not on PATH', async () => {
      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'printed' },
      })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain(`claude ${claudeAdd('local').join(' ')}`)
    })

    test('never runs an agent binary from the project folder or a relative PATH entry', async () => {
      await writeFile(join(project, executableName('claude')), '')
      await chmod(join(project, executableName('claude')), 0o755)

      await run({ NETLIFY_AGENT: 'claude-code' }, { path: ['.', project.replace(root, '..')].join(delimiter) })

      expect(execaMock).not.toHaveBeenCalled()
    })

    test('respects a saved no from the prompt for this project', async () => {
      await install('claude')
      saved.set('agentMcpSetup.claude-code', { url: NETLIFY_MCP_URL, scope: 'project', choice: 'declined' })

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'declined' },
      })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain('init --reset-mcp-setup')
    })

    test('--reset-mcp-setup forgets a saved no for the agent running init', async () => {
      await install('claude')
      saved.set('agentMcpSetup.claude-code', { url: NETLIFY_MCP_URL, scope: 'project', choice: 'declined' })
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { reset: true })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })

      expect(saved.get('agentMcpSetup.claude-code')).toBeUndefined()
    })

    test('prints the generic project command for an agent it has no mapping for', async () => {
      await expect(run({ AGENT: 'amp' }, { interactive: true })).resolves.toMatchObject({ selection: 'none' })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(logged()).toContain(ADD_MCP)
      expect(logged()).not.toContain(`${ADD_MCP} -`)
    })
  })

  describe('when a person runs init', () => {
    test('offers detected agents preticked and installed ones unticked', async () => {
      await mkdir(join(project, '.cursor'))
      await install('code', 'codex')
      const choose = chooseIds()

      await run({ TERM_PROGRAM: 'vscode' }, { interactive: true, choose })

      expect(choose.mock.calls[0][0].map(({ agent, detected }) => [agent.id, detected])).toEqual([
        ['vscode', true],
        ['cursor', true],
        ['codex', false],
      ])
    })

    test('adds Claude for this project only after checking it has no Netlify server yet', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(UNRELATED_LINE)).mockResolvedValueOnce(exited(0))

      await expect(run({}, { interactive: true, choose: chooseIds('claude-code') })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })

      expect(execaMock).toHaveBeenNthCalledWith(2, installed('claude'), claudeAdd('local'), expect.anything())
      expect(logged()).toContain('for this project')
      expect(logged()).toContain('claude mcp remove --scope local netlify')
    })

    test('prints project commands for ticked agents whose CLIs only add user-wide', async () => {
      await install('code')

      await expect(
        run({ TERM_PROGRAM: 'vscode' }, { interactive: true, choose: chooseIds('vscode') }),
      ).resolves.toMatchObject({ agents: { vscode: 'printed' } })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain(`${ADD_MCP} -y -a vscode`)
      expect(logged()).toContain(join('.vscode', 'mcp.json'))
      expect(logged()).toContain('Run the command shown for VS Code to finish')
    })

    test('runs the agent CLI for user scope', async () => {
      await install('code')
      execaMock.mockResolvedValueOnce(exited(0))

      await expect(
        run({ TERM_PROGRAM: 'vscode' }, { interactive: true, choose: chooseIds('vscode'), scope: 'user' }),
      ).resolves.toMatchObject({ agents: { vscode: 'added' } })

      expect(execaMock).toHaveBeenCalledWith(
        installed('code'),
        ['--add-mcp', JSON.stringify({ name: 'netlify', type: 'http', url: NETLIFY_MCP_URL })],
        expect.objectContaining({ stdin: 'ignore' }),
      )
      expect(logged()).toContain('replaced any')
    })

    test('leaves a ticked agent alone when it already has another Netlify server', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(LOCAL_LINE))

      await expect(run({}, { interactive: true, choose: chooseIds('claude-code') })).resolves.toMatchObject({
        agents: { 'claude-code': 'kept' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
    })

    test('does not add when the lookup fails', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(exited(1, 'boom'))

      await expect(run({}, { interactive: true, choose: chooseIds('claude-code') })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
      expect(warned()).toContain('boom')
    })

    test('does not add when the lookup times out', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(timedOut())

      await expect(run({}, { interactive: true, choose: chooseIds('claude-code') })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(warned()).toContain('timed out')
    })

    test('reports a failed add with the command to run by hand', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'nope'))

      await expect(run({}, { interactive: true, choose: chooseIds('claude-code') })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(warned()).toContain('nope')
      expect(logged()).toContain(`claude ${claudeAdd('local').join(' ')}`)
    })

    test('adds nothing when the person unticks every agent', async () => {
      await install('claude')

      await expect(run({}, { interactive: true, choose: chooseIds() })).resolves.toMatchObject({
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

      await expect(run({})).resolves.toMatchObject({ selection: 'none', agents: {} })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(execaMock).not.toHaveBeenCalled()
    })
  })

  describe('saved choices', () => {
    test('remembers both a yes and a no for this project, so the next run does not prompt', async () => {
      await install('claude', 'codex')
      execaMock
        .mockResolvedValueOnce(listed())
        .mockResolvedValueOnce(exited(0))
        .mockResolvedValueOnce(exited(1, 'No MCP server named "netlify"'))
      const choose = chooseIds('claude-code')

      await run({}, { interactive: true, choose })
      expect(offeredIds(choose)).toEqual(['claude-code', 'codex'])
      expect(saved.get('agentMcpSetup.codex')).toEqual({ url: NETLIFY_MCP_URL, scope: 'project', choice: 'declined' })

      await expect(run({}, { interactive: true })).resolves.toMatchObject({ selection: 'saved' })
      expect(neverChoose).not.toHaveBeenCalled()
      expect(logged()).toContain('Using your saved choices')
    })

    test('a choice saved for project scope does not answer a user-scope run', async () => {
      await install('codex')
      saved.set('agentMcpSetup.codex', { url: NETLIFY_MCP_URL, scope: 'project', choice: 'declined' })
      const choose = chooseIds()

      await run({}, { interactive: true, choose, scope: 'user' })

      expect(offeredIds(choose)).toEqual(['codex'])
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

    test('does not save a yes whose add failed or that kept another server', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(LOCAL_LINE))
      await run({}, { interactive: true, choose: chooseIds('claude-code') })
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['claude-code'])
    })

    test('an agent-driven run does not save anything', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

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
