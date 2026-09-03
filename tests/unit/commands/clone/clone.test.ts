import { resolve } from 'path'

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const { mockAuthenticate, mockListSites, mockExeca } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockListSites: vi.fn(),
  mockExeca: vi.fn(),
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  logAndThrowError: (message: unknown): never => {
    throw message instanceof Error ? message : new Error(String(message))
  },
}))

vi.mock('../../../../src/utils/execa.js', () => ({
  default: mockExeca,
}))

import { clone, getCredentialHelper } from '../../../../src/commands/clone/clone.js'

function createMockCommand(overrides: { siteId?: string } = {}) {
  return {
    authenticate: mockAuthenticate,
    netlify: {
      api: { listSites: mockListSites },
      site: { id: overrides.siteId },
    },
  } as unknown as Parameters<typeof clone>[1]
}

describe('clone command', () => {
  describe('clone', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockAuthenticate.mockResolvedValue(undefined)
      mockExeca.mockResolvedValue({ exitCode: 0 })
    })

    it('aborts with an actionable error when the current directory is already linked to a project', async () => {
      const command = createMockCommand({ siteId: 'existing-site-id' })

      await expect(clone({}, command, { repo: 'owner/repo' })).rejects.toThrow(/already linked to a Netlify project/)

      expect(mockAuthenticate).toHaveBeenCalledOnce()
      expect(mockExeca).not.toHaveBeenCalled()
      expect(mockListSites).not.toHaveBeenCalled()
    })

    it('aborts with an actionable error when the current directory is already inside a git repository', async () => {
      const command = createMockCommand()
      mockExeca.mockResolvedValue({ exitCode: 0 })

      await expect(clone({}, command, { repo: 'owner/repo' })).rejects.toThrow(/already inside a git repository/)

      expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', '--is-inside-work-tree'])
      expect(mockListSites).not.toHaveBeenCalled()
    })

    it('does not abort when the current directory is not inside a git repository', async () => {
      const command = createMockCommand()
      mockExeca.mockRejectedValue(new Error('fatal: not a git repository'))
      mockListSites.mockResolvedValue([])

      await expect(clone({}, command, { repo: 'my-site' })).rejects.toThrow(/Could not find a Netlify site named/)

      expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', '--is-inside-work-tree'])
      expect(mockListSites).toHaveBeenCalled()
    })
  })

  describe('getCredentialHelper', () => {
    const originalArgv1 = process.argv[1]

    beforeEach(() => {
      vi.stubEnv('npm_lifecycle_event', undefined)
      vi.stubEnv('npm_config_user_agent', undefined)
      vi.stubEnv('npm_command', undefined)
      process.argv[1] = '/some/path/to/bin/run.js'
    })

    afterEach(() => {
      vi.unstubAllEnvs()
      process.argv[1] = originalArgv1
    })

    it('pins the resolved node + script path when invoked directly', () => {
      expect(getCredentialHelper()).toBe(
        `!'${process.execPath}' '${resolve('/some/path/to/bin/run.js')}' git-credential`,
      )
    })

    it('falls back to `npx netlify` when invoked via npx, since argv[1] points into a temp cache dir', () => {
      vi.stubEnv('npm_lifecycle_event', 'npx')

      expect(getCredentialHelper()).toBe('!npx netlify git-credential')
    })

    it('falls back to `pnpm exec netlify` when invoked via pnpm exec', () => {
      vi.stubEnv('npm_config_user_agent', 'pnpm/8.0.0 npm/? node/v18.0.0')
      vi.stubEnv('npm_command', 'exec')

      expect(getCredentialHelper()).toBe('!pnpm exec netlify git-credential')
    })
  })
})
