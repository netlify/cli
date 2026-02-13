import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest'
import type { RepoData } from '../../../../src/utils/get-repo-data.js'
import type { NetlifyAPI } from '@netlify/api'

const mockPrompt = vi.fn()
const mockLog = vi.fn()
const mockExit = vi.fn()
const mockCreateDeployKey = vi.fn()
const mockGetBuildSettings = vi.fn()
const mockSaveNetlifyToml = vi.fn()
const mockSetupSite = vi.fn()

vi.mock('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
}))

vi.mock('../../../../src/utils/command-helpers.js', () => ({
  log: mockLog,
  exit: mockExit,
}))

vi.mock('../../../../src/utils/init/utils.js', () => ({
  createDeployKey: mockCreateDeployKey,
  getBuildSettings: mockGetBuildSettings,
  saveNetlifyToml: mockSaveNetlifyToml,
  setupSite: mockSetupSite,
}))

describe('config-manual', () => {
  let mockApi: Partial<NetlifyAPI>
  let mockCommand: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockApi = {}
    mockCommand = {
      netlify: {
        api: mockApi,
        cachedConfig: { configPath: '/test/netlify.toml' },
        config: { plugins: [] },
        repositoryRoot: '/test',
      },
    }

    mockPrompt.mockResolvedValue({
      sshKeyAdded: true,
      repoPath: 'git@gitlab.com:test/repo.git',
      deployHookAdded: true,
    })

    mockCreateDeployKey.mockResolvedValue({ id: 'key-123', public_key: 'ssh-rsa test' })
    mockGetBuildSettings.mockResolvedValue({
      baseDir: '',
      buildCmd: 'npm run build',
      buildDir: 'dist',
      functionsDir: 'functions',
      pluginsToInstall: [],
    })
    mockSaveNetlifyToml.mockResolvedValue(undefined)
    mockSetupSite.mockResolvedValue({ deploy_hook: 'https://api.netlify.com/hooks/test' })
  })

  describe('GitLab repository configuration', () => {
    it('should use provider from repoData for GitLab repos', async () => {
      const configManual = (await import('../../../../src/utils/init/config-manual.js')).default

      const repoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'git@gitlab.com:ownername/test.git',
        branch: 'main',
        provider: 'gitlab',
        httpsUrl: 'https://gitlab.com/ownername/test',
      }

      await configManual({
        command: mockCommand,
        repoData,
        siteId: 'site-123',
      })

      expect(mockSetupSite).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: expect.objectContaining({
            provider: 'gitlab',
            repo_path: 'ownername/test',
          }),
        }),
      )
    })

    it('should use repo path (owner/name format) instead of SSH URL for GitLab', async () => {
      const configManual = (await import('../../../../src/utils/init/config-manual.js')).default

      const repoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'git@gitlab.com:ownername/test.git',
        branch: 'main',
        provider: 'gitlab',
        httpsUrl: 'https://gitlab.com/ownername/test',
      }

      await configManual({
        command: mockCommand,
        repoData,
        siteId: 'site-123',
      })

      const setupSiteCall = (mockSetupSite as Mock).mock.calls[0][0]
      expect(setupSiteCall.repo.repo_path).toBe('ownername/test')
      expect(setupSiteCall.repo.repo_path).not.toBe('git@gitlab.com:ownername/test.git')
    })

    it('should fallback to manual provider when provider is null', async () => {
      const configManual = (await import('../../../../src/utils/init/config-manual.js')).default

      const repoData: RepoData = {
        name: 'test',
        owner: 'user',
        repo: 'user/test',
        url: 'git@custom.com:user/test.git',
        branch: 'main',
        provider: null,
        httpsUrl: 'https://custom.com/user/test',
      }

      await configManual({
        command: mockCommand,
        repoData,
        siteId: 'site-123',
      })

      expect(mockSetupSite).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: expect.objectContaining({
            provider: 'manual',
          }),
        }),
      )
    })
  })

  describe('GitHub repository configuration', () => {
    it('should use provider from repoData for GitHub repos', async () => {
      const configManual = (await import('../../../../src/utils/init/config-manual.js')).default

      const repoData: RepoData = {
        name: 'test',
        owner: 'user',
        repo: 'user/test',
        url: 'git@github.com:user/test.git',
        branch: 'main',
        provider: 'github',
        httpsUrl: 'https://github.com/user/test',
      }

      await configManual({
        command: mockCommand,
        repoData,
        siteId: 'site-123',
      })

      expect(mockSetupSite).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: expect.objectContaining({
            provider: 'github',
            repo_path: 'user/test',
          }),
        }),
      )
    })
  })
})
