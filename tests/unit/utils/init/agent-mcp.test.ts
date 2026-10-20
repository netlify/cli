import { afterEach, describe, expect, test, vi } from 'vitest'

import { log, warn } from '../../../../src/utils/command-helpers.js'
import execa from '../../../../src/utils/execa.js'
import { NETLIFY_MCP_URL, setupAgentMcp } from '../../../../src/utils/init/agent-mcp.js'

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  log: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('../../../../src/utils/execa.js', () => ({ default: vi.fn() }))

const execaMock = vi.mocked(execa) as unknown as ReturnType<typeof vi.fn>

const exited = (exitCode: number, stderr = '') => ({ exitCode, stdout: '', stderr, timedOut: false })
const notInstalled = () => ({ code: 'ENOENT', exitCode: undefined, stdout: '', stderr: '', timedOut: false })
const timedOut = () => ({ exitCode: undefined, stdout: '', stderr: '', timedOut: true })

const ADD_ARGS = ['mcp', 'add', '--transport', 'http', '--scope', 'local', 'netlify', NETLIFY_MCP_URL]

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

describe('setupAgentMcp', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('adds the hosted server at local scope from the project root when Claude Code has none', async () => {
    execaMock.mockResolvedValueOnce(exited(1, 'No MCP server named "netlify"')).mockResolvedValueOnce(exited(0))

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({ claudeCode: 'added' })

    expect(execaMock).toHaveBeenNthCalledWith(
      1,
      'claude',
      ['mcp', 'get', 'netlify'],
      expect.objectContaining({ cwd: '/project', reject: false }),
    )
    expect(execaMock).toHaveBeenNthCalledWith(
      2,
      'claude',
      ADD_ARGS,
      expect.objectContaining({ cwd: '/project', reject: false }),
    )
    expect(logged()).toContain('Nothing was written to the repository')
    expect(logged()).toContain('claude mcp remove --scope local netlify')
  })

  test('leaves an existing netlify server alone, whatever scope or host it uses', async () => {
    execaMock.mockResolvedValueOnce(exited(0))

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({ claudeCode: 'present' })

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(logged()).toContain('already has a netlify MCP server')
  })

  test('does nothing for Claude Code when it is not installed, and still points at the docs', async () => {
    execaMock.mockResolvedValueOnce(notInstalled())

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({ claudeCode: 'unavailable' })

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
    expect(logged()).toContain('docs.netlify.com/welcome/build-with-ai/netlify-mcp-server')
  })

  test('does not add when the lookup times out, so it never risks a duplicate', async () => {
    execaMock.mockResolvedValueOnce(timedOut())

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toMatchObject({ claudeCode: 'failed' })

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(warned()).toContain('timed out')
    expect(logged()).toContain(`claude ${ADD_ARGS.join(' ')}`)
  })

  test('points an existing entry on the old host at the new one, without changing it', async () => {
    execaMock.mockResolvedValueOnce({ ...exited(0), stdout: 'URL: https://netlify-mcp.netlify.app/mcp' })

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({ claudeCode: 'present' })

    expect(execaMock).toHaveBeenCalledTimes(1)
    expect(logged()).toContain(`now lives at ${NETLIFY_MCP_URL}`)
  })

  test('does not add when the lookup fails for a reason other than a missing server', async () => {
    execaMock.mockResolvedValueOnce(exited(1, 'Failed to connect'))

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({
      claudeCode: 'failed',
      error: 'Failed to connect',
    })

    expect(execaMock).toHaveBeenCalledTimes(1)
  })

  test('reports a failed add with the command to run by hand, without throwing', async () => {
    execaMock.mockResolvedValueOnce(exited(1, 'No MCP server named "netlify"')).mockResolvedValueOnce(exited(1, 'boom'))

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({ claudeCode: 'failed', error: 'boom' })

    expect(warned()).toContain('boom')
    expect(logged()).toContain(`claude ${ADD_ARGS.join(' ')}`)
  })

  test('turns an unexpected exception into a failure instead of breaking init', async () => {
    execaMock.mockRejectedValueOnce(new Error('spawn exploded'))

    await expect(setupAgentMcp({ workingDir: '/project' })).resolves.toEqual({
      claudeCode: 'failed',
      error: 'spawn exploded',
    })
  })
})
