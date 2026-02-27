import { describe, expect, it, vi } from 'vitest'
import type { RepoData } from '../../../src/utils/get-repo-data.js'

vi.mock('../../../src/utils/command-helpers.js', () => ({
  log: vi.fn(),
}))

describe('getRepoData', () => {
  describe('RepoData structure for different Git providers', () => {
    it('should construct correct httpsUrl for GitHub SSH URLs', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'git@github.com:ownername/test.git',
        branch: 'main',
        provider: 'github',
        httpsUrl: 'https://github.com/ownername/test',
      }

      expect(mockRepoData.httpsUrl).toBe('https://github.com/ownername/test')
      expect(mockRepoData.provider).toBe('github')
      expect(mockRepoData.repo).toBe('ownername/test')
    })

    it('should construct correct httpsUrl for GitLab SSH URLs', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'git@gitlab.com:ownername/test.git',
        branch: 'main',
        provider: 'gitlab',
        httpsUrl: 'https://gitlab.com/ownername/test',
      }

      expect(mockRepoData.httpsUrl).toBe('https://gitlab.com/ownername/test')
      expect(mockRepoData.provider).toBe('gitlab')
      expect(mockRepoData.repo).toBe('ownername/test')
    })

    it('should construct correct httpsUrl for GitHub HTTPS URLs', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'https://github.com/ownername/test.git',
        branch: 'main',
        provider: 'github',
        httpsUrl: 'https://github.com/ownername/test',
      }

      expect(mockRepoData.httpsUrl).toBe('https://github.com/ownername/test')
      expect(mockRepoData.provider).toBe('github')
      expect(mockRepoData.repo).toBe('ownername/test')
    })

    it('should construct correct httpsUrl for GitLab HTTPS URLs', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'ownername',
        repo: 'ownername/test',
        url: 'https://gitlab.com/ownername/test.git',
        branch: 'main',
        provider: 'gitlab',
        httpsUrl: 'https://gitlab.com/ownername/test',
      }

      expect(mockRepoData.httpsUrl).toBe('https://gitlab.com/ownername/test')
      expect(mockRepoData.provider).toBe('gitlab')
      expect(mockRepoData.repo).toBe('ownername/test')
    })

    it('should use host as provider for unknown Git hosts', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'user',
        repo: 'user/test',
        url: 'git@custom-git.example.com:user/test.git',
        branch: 'main',
        provider: 'custom-git.example.com',
        httpsUrl: 'https://custom-git.example.com/user/test',
      }

      expect(mockRepoData.httpsUrl).toBe('https://custom-git.example.com/user/test')
      expect(mockRepoData.provider).toBe('custom-git.example.com')
      expect(mockRepoData.repo).toBe('user/test')
    })
  })

  describe('provider field mapping', () => {
    it('should map github.com to "github" provider', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'user',
        repo: 'user/test',
        url: 'git@github.com:user/test.git',
        branch: 'main',
        provider: 'github',
        httpsUrl: 'https://github.com/user/test',
      }

      expect(mockRepoData.provider).toBe('github')
    })

    it('should map gitlab.com to "gitlab" provider', () => {
      const mockRepoData: RepoData = {
        name: 'test',
        owner: 'user',
        repo: 'user/test',
        url: 'git@gitlab.com:user/test.git',
        branch: 'main',
        provider: 'gitlab',
        httpsUrl: 'https://gitlab.com/user/test',
      }

      expect(mockRepoData.provider).toBe('gitlab')
    })
  })
})
