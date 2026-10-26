import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, relative, resolve } from 'node:path'

import { LocalState } from '@netlify/dev-utils'
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
const codexListed = (...servers: { name: string; transport: Record<string, unknown> }[]) =>
  exited(0, '', JSON.stringify(servers))

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

const executableName = (binary: string) => (process.platform === 'win32' ? `${binary}.CMD` : binary)

const binUnderCwd = async () => {
  const parent = resolve('tmp')
  await mkdir(parent, { recursive: true })
  return await mkdtemp(join(parent, 'netlify-agent-mcp-bin-'))
}

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
    store = {
      get: (key) => saved.get(key),
      set: (key, value) => saved.set(key, value),
      delete: (key) => saved.delete(key),
    }
  })

  afterEach(async () => {
    vi.clearAllMocks()
    execaMock.mockReset()
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
    options: {
      interactive?: boolean
      choose?: ChooseAgents
      reset?: boolean
      path?: string
      scope?: McpScope
      store?: McpChoiceStore
    } = {},
  ) =>
    setupAgentMcp({
      workingDir: project,
      store: options.store ?? store,
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
      expect(logged()).toContain("Saved in ~/.claude.json, under this project's path")
      expect(logged()).toContain('claude mcp remove --scope local netlify')
      expect(logged()).toContain('loads the next time you start Claude Code in this folder')
    })

    test('does not install when the existing-server check fails', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(exited(1, 'boom'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(execaMock).toHaveBeenCalledTimes(1)
    })

    test('installs user-wide only when --mcp-scope user is passed', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })

      expect(execaMock).toHaveBeenNthCalledWith(2, installed('claude'), claudeAdd('user'), expect.anything())
    })

    test('prints a project add-mcp command for Codex, naming the file it writes', async () => {
      await install('codex')
      execaMock.mockResolvedValueOnce(codexListed())

      await expect(run({ CODEX_CI: '1' })).resolves.toMatchObject({ agents: { codex: 'printed' } })

      expect(execaMock).toHaveBeenCalledWith(installed('codex'), ['mcp', 'list', '--json'], expect.anything())
      expect(logged()).toContain(`${ADD_MCP} -y -a codex`)
      expect(logged()).not.toContain(' -g')
      expect(logged()).toContain(join('.codex', 'config.toml'))
    })

    test('runs the Codex CLI when the scope is user', async () => {
      await install('codex')
      execaMock.mockResolvedValueOnce(codexListed()).mockResolvedValueOnce(exited(0))

      await expect(run({ CODEX_CI: '1' }, { scope: 'user' })).resolves.toMatchObject({ agents: { codex: 'added' } })

      expect(execaMock).toHaveBeenNthCalledWith(
        2,
        installed('codex'),
        ['mcp', 'add', 'netlify', '--url', NETLIFY_MCP_URL],
        expect.anything(),
      )
      expect(logged()).toContain('loads the next time you start Codex.')
    })

    test.each([
      ['the hosted URL under another name', { type: 'streamable_http', url: NETLIFY_MCP_URL }, 'present'],
      [
        'the local npx server under another name',
        { type: 'stdio', command: 'npx', args: ['-y', '@netlify/mcp'] },
        'kept',
      ],
    ])('finds a Codex server with %s', async (_, transport, status) => {
      await install('codex')
      execaMock.mockResolvedValueOnce(codexListed({ name: 'netlify-prod', transport }))

      await expect(run({ CODEX_CI: '1' }, { scope: 'user' })).resolves.toMatchObject({ agents: { codex: status } })

      expect(execaMock).toHaveBeenCalledTimes(1)
    })

    test('treats unreadable Codex output as a failed check and adds nothing', async () => {
      await install('codex')
      execaMock.mockResolvedValueOnce(exited(0, '', 'not json'))

      await expect(run({ CODEX_CI: '1' }, { scope: 'user' })).resolves.toMatchObject({ agents: { codex: 'failed' } })

      expect(execaMock).toHaveBeenCalledTimes(1)
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
      expect(logged()).toContain('init --reset-mcp-setup')
      expect(logged()).not.toContain('mcp add')
    })

    test('prints an existing server name without its control characters', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed('\u001B[2J\u0007evil:netlify: npx -y @netlify/mcp - ✔ Connected'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'kept' },
      })

      expect(logged()).toContain('[2Jevil:netlify')
      expect(logged()).not.toContain('\u001B[2J')
      expect(logged()).not.toContain('\u0007')
    })

    test('adds the server when the only Netlify entry is a .mcp.json server still pending approval', async () => {
      await install('claude')
      execaMock
        .mockResolvedValueOnce(listed(`netlify: ${NETLIFY_MCP_URL} (HTTP) - ⏸ Pending approval`))
        .mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })
    })

    test.each([
      ['another port', 'https://mcp.netlify.com:8443/mcp'],
      ['another scheme', 'http://mcp.netlify.com/mcp'],
      ['another path', 'https://mcp.netlify.com/mcp/v2'],
      ['a query', 'https://mcp.netlify.com/mcp?token=x'],
      ['a fragment', 'https://mcp.netlify.com/mcp#x'],
      ['credentials', 'https://user:secret@mcp.netlify.com/mcp'],
    ])('treats the hosted host with %s as another Netlify server', async (_, url) => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(`netlify: ${url} (HTTP) - ✔ Connected`))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'kept' },
      })
    })

    test('adds user-wide when the only Netlify entry is set for this project', async () => {
      await install('claude')
      execaMock
        .mockResolvedValueOnce(listed(OURS_LINE))
        .mockResolvedValueOnce(exited(0, '', 'netlify:\n  Scope: Local config (private to you in this project)\n'))
        .mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })

      expect(execaMock).toHaveBeenNthCalledWith(2, installed('claude'), ['mcp', 'get', 'netlify'], expect.anything())
      expect(execaMock).toHaveBeenNthCalledWith(3, installed('claude'), claudeAdd('user'), expect.anything())
    })

    test('leaves a user-wide entry alone when the scope is user', async () => {
      await install('claude')
      execaMock
        .mockResolvedValueOnce(listed(OURS_LINE))
        .mockResolvedValueOnce(exited(0, '', 'netlify:\n  Scope: User config (available in all your projects)\n'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })).resolves.toMatchObject({
        agents: { 'claude-code': 'present' },
      })

      expect(execaMock).toHaveBeenCalledTimes(2)
    })

    test('leaves a user-wide Netlify server under another name alone when ours is only set for this project', async () => {
      await install('claude')
      execaMock
        .mockResolvedValueOnce(listed(OURS_LINE, 'netlify-stdio: npx -y @netlify/mcp - ✔ Connected'))
        .mockResolvedValueOnce(exited(0, '', 'netlify:\n  Scope: Local config (private to you in this project)\n'))
        .mockResolvedValueOnce(exited(0, '', 'netlify-stdio:\n  Scope: User config (available in all your projects)\n'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })).resolves.toMatchObject({
        agents: { 'claude-code': 'kept' },
      })

      expect(execaMock).toHaveBeenNthCalledWith(
        3,
        installed('claude'),
        ['mcp', 'get', 'netlify-stdio'],
        expect.anything(),
      )
      expect(execaMock).toHaveBeenCalledTimes(3)
    })

    test('adds nothing user-wide when the scope of an existing entry cannot be read', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(OURS_LINE)).mockResolvedValueOnce(exited(1, 'boom'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { scope: 'user' })).resolves.toMatchObject({
        agents: { 'claude-code': 'failed' },
      })

      expect(execaMock).toHaveBeenCalledTimes(2)
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

    test('suggests nothing user-wide at project scope for an agent with no per-project setting', async () => {
      await expect(run({ CLINE_ACTIVE: 'true' })).resolves.toMatchObject({ agents: { cline: 'unsupported' } })

      expect(logged()).toContain('has no per-project MCP setting')
      expect(logged()).toContain('init --mcp-scope user')
      expect(logged()).not.toContain(' -g')
    })

    test('suggests the user-wide command for that agent when the scope is user', async () => {
      await run({ CLINE_ACTIVE: 'true' }, { scope: 'user' })

      expect(logged()).toContain(`${ADD_MCP} -g -y -a cline`)
    })

    test('prints the command without a lookup when the agent CLI is not on PATH', async () => {
      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'printed' },
      })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain(`claude ${claudeAdd('local').join(' ')}`)
    })

    describe('with a PATH entry relative to the working directory', () => {
      let cwdBin: string

      beforeEach(async () => {
        cwdBin = await binUnderCwd()
        const file = join(cwdBin, executableName('claude'))
        await writeFile(file, '')
        await chmod(file, 0o755)
      })

      afterEach(async () => {
        await rm(cwdBin, { recursive: true, force: true })
      })

      test('never runs an agent binary found through it', async () => {
        const relativeBin = relative(resolve(), cwdBin)
        expect(relativeBin).not.toBe(cwdBin)

        await expect(run({ NETLIFY_AGENT: 'claude-code' }, { path: relativeBin })).resolves.toMatchObject({
          agents: { 'claude-code': 'printed' },
        })

        expect(execaMock).not.toHaveBeenCalled()
      })

      test('runs the agent binary from the same directory once it is absolute', async () => {
        execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

        await run({ NETLIFY_AGENT: 'claude-code' }, { path: [relative(resolve(), cwdBin), cwdBin].join(delimiter) })

        expect(execaMock).toHaveBeenNthCalledWith(
          1,
          join(cwdBin, executableName('claude')),
          ['mcp', 'list'],
          expect.anything(),
        )
      })
    })

    test.skipIf(process.platform === 'win32')('never runs an agent binary that is not executable', async () => {
      await writeFile(installed('claude'), '')
      await chmod(installed('claude'), 0o644)

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'printed' },
      })

      expect(execaMock).not.toHaveBeenCalled()
    })

    test('never runs a directory that has the agent binary name', async () => {
      await mkdir(installed('claude'))

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'printed' },
      })

      expect(execaMock).not.toHaveBeenCalled()
    })

    test('respects a saved no from the prompt for this project', async () => {
      await install('claude')
      saved.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })

      await expect(run({ NETLIFY_AGENT: 'claude-code' })).resolves.toMatchObject({
        agents: { 'claude-code': 'declined' },
      })

      expect(execaMock).not.toHaveBeenCalled()
      expect(logged()).toContain('init --reset-mcp-setup')
    })

    test('--reset-mcp-setup replaces a saved no once the agent running init has the server', async () => {
      await install('claude')
      saved.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await expect(run({ NETLIFY_AGENT: 'claude-code' }, { reset: true })).resolves.toMatchObject({
        agents: { 'claude-code': 'added' },
      })

      expect(saved.get('agentMcpSetup.project.claude-code')).toEqual({ url: NETLIFY_MCP_URL, choice: 'accepted' })
    })

    test('--reset-mcp-setup keeps a saved no when the add fails for the agent running init', async () => {
      await install('claude')
      const declined = { url: NETLIFY_MCP_URL, choice: 'declined' }
      saved.set('agentMcpSetup.project.claude-code', declined)
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'boom'))

      await run({ NETLIFY_AGENT: 'claude-code' }, { reset: true })

      expect(saved.get('agentMcpSetup.project.claude-code')).toEqual(declined)
    })

    test('prints the generic command with how to skip its questions for an agent it has no mapping for', async () => {
      await expect(run({ AGENT: 'amp' })).resolves.toMatchObject({ selection: 'none' })

      expect(neverChoose).not.toHaveBeenCalled()
      expect(logged()).toContain(ADD_MCP)
      expect(logged()).not.toContain(`${ADD_MCP} -`)
      expect(logged()).toContain('-y -a <agent>')
      expect(logged()).toContain('add-mcp@2.4.1 list-agents')
    })

    test('shows the checkbox to a person in a terminal when the detected agent has no mapping', async () => {
      await install('claude')
      const choose = chooseIds()

      await expect(run({ AGENT: 'amp' }, { interactive: true, choose })).resolves.toMatchObject({
        selection: 'prompt',
      })

      expect(offeredIds(choose)).toEqual(['claude-code'])
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

    test('prints instead of running an agent CLI that cannot check for an existing server', async () => {
      await install('code')

      await expect(
        run({ TERM_PROGRAM: 'vscode' }, { interactive: true, choose: chooseIds('vscode'), scope: 'user' }),
      ).resolves.toMatchObject({ agents: { vscode: 'printed' } })

      expect(execaMock).not.toHaveBeenCalled()
      const config = JSON.stringify({ name: 'netlify', type: 'http', url: NETLIFY_MCP_URL })
      const quoted = process.platform === 'win32' ? `"${config.replace(/"/g, '\\"')}"` : `'${config}'`
      expect(logged()).toContain(`code --add-mcp ${quoted}`)
      expect(logged()).toContain('Running it replaces any')
    })

    test('leaves agents with no per-project setting out of the project-scope prompt', async () => {
      await mkdir(join(project, '.windsurf'))
      await install('windsurf', 'claude')
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['claude-code'])
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
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))
      const choose = chooseIds('claude-code')

      await run({}, { interactive: true, choose })
      expect(offeredIds(choose)).toEqual(['claude-code', 'codex'])
      expect(saved.get('agentMcpSetup.project.codex')).toEqual({ url: NETLIFY_MCP_URL, choice: 'declined' })

      await expect(run({}, { interactive: true })).resolves.toMatchObject({ selection: 'saved' })
      expect(neverChoose).not.toHaveBeenCalled()
      expect(logged()).toContain('Using your saved choices')
    })

    test('a choice saved for project scope does not answer a user-scope run', async () => {
      await install('codex')
      saved.set('agentMcpSetup.project.codex', { url: NETLIFY_MCP_URL, choice: 'declined' })
      const choose = chooseIds()

      await run({}, { interactive: true, choose, scope: 'user' })

      expect(offeredIds(choose)).toEqual(['codex'])
    })

    test('a user-scope run keeps the project answer, so the next default run does not ask again', async () => {
      await install('codex')
      await run({}, { interactive: true, choose: chooseIds() })
      await run({}, { interactive: true, choose: chooseIds(), scope: 'user' })

      await expect(run({}, { interactive: true })).resolves.toMatchObject({ selection: 'saved' })
      expect(saved.get('agentMcpSetup.project.codex')).toEqual({ url: NETLIFY_MCP_URL, choice: 'declined' })
      expect(saved.get('agentMcpSetup.user.codex')).toEqual({ url: NETLIFY_MCP_URL, choice: 'declined' })
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

    test('remembers a kept server, so a rerun does not offer the agent again', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed(LOCAL_LINE))
      await run({}, { interactive: true, choose: chooseIds('claude-code') })

      await expect(run({}, { interactive: true })).resolves.toMatchObject({ selection: 'saved' })
      expect(saved.get('agentMcpSetup.project.claude-code')).toEqual({ url: NETLIFY_MCP_URL, choice: 'kept' })
    })

    test('does not save a yes whose add failed, so it is offered again', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'boom'))
      await run({}, { interactive: true, choose: chooseIds('claude-code') })
      const choose = chooseIds()

      await run({}, { interactive: true, choose })

      expect(offeredIds(choose)).toEqual(['claude-code'])
    })

    test('forgets a saved no when the add fails after --reset-mcp-setup, so it is offered again', async () => {
      await install('claude')
      saved.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'boom'))
      await run({}, { interactive: true, choose: chooseIds('claude-code'), reset: true })
      expect(saved.has('agentMcpSetup.project.claude-code')).toBe(false)
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

  describe('with the real project state file', () => {
    const stateFile = () => join(project, '.netlify', 'state.json')

    test('saves a choice nested under agentMcpSetup and reads it back on the next run', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await run({}, { interactive: true, choose: chooseIds('claude-code'), store: new LocalState(project) })

      const written = JSON.parse(await readFile(stateFile(), 'utf8')) as Record<string, unknown>
      expect(written).toEqual({
        agentMcpSetup: { project: { 'claude-code': { url: NETLIFY_MCP_URL, choice: 'accepted' } } },
      })
      await expect(run({}, { interactive: true, store: new LocalState(project) })).resolves.toMatchObject({
        selection: 'saved',
      })
    })

    test('an agent run with --reset-mcp-setup and nothing saved never creates the state file', async () => {
      await install('claude')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await run({ NETLIFY_AGENT: 'claude-code' }, { reset: true, store: new LocalState(project) })

      await expect(readFile(stateFile(), 'utf8')).rejects.toThrow(/ENOENT/)
    })

    test('an agent run with --reset-mcp-setup leaves the state file byte for byte when the add fails', async () => {
      await install('claude')
      const state = new LocalState(project)
      state.set('siteId', 'site_id')
      state.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })
      const before = await readFile(stateFile(), 'utf8')
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'boom'))

      await run({ NETLIFY_AGENT: 'claude-code' }, { reset: true, store: new LocalState(project) })

      await expect(readFile(stateFile(), 'utf8')).resolves.toBe(before)
    })

    test('an agent run with --reset-mcp-setup changes only the saved no once the add succeeds', async () => {
      await install('claude')
      const state = new LocalState(project)
      state.set('siteId', 'site_id')
      state.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(0))

      await run({ NETLIFY_AGENT: 'claude-code' }, { reset: true, store: new LocalState(project) })

      await expect(readFile(stateFile(), 'utf8').then(JSON.parse)).resolves.toEqual({
        siteId: 'site_id',
        agentMcpSetup: { project: { 'claude-code': { url: NETLIFY_MCP_URL, choice: 'accepted' } } },
      })
    })

    test('forgets a saved no through the real state file when an add fails after --reset-mcp-setup', async () => {
      await install('claude')
      const state = new LocalState(project)
      state.set('siteId', 'site_id')
      state.set('agentMcpSetup.project.claude-code', { url: NETLIFY_MCP_URL, choice: 'declined' })
      execaMock.mockResolvedValueOnce(listed()).mockResolvedValueOnce(exited(1, 'boom'))

      await run(
        {},
        { interactive: true, choose: chooseIds('claude-code'), reset: true, store: new LocalState(project) },
      )

      await expect(readFile(stateFile(), 'utf8').then(JSON.parse)).resolves.toEqual({
        siteId: 'site_id',
        agentMcpSetup: { project: {} },
      })
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
