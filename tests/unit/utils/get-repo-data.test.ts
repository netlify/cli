import { beforeEach, describe, expect, it, vi } from 'vitest'

import getRepoData from '../../../src/utils/get-repo-data.js'

const mockGitConfig = vi.fn()
const mockFindUp = vi.fn()
const mockGitRepoInfo = vi.fn()

vi.mock('gitconfiglocal', () => ({
  default: (workingDir: string, cb: (err: Error | null, config: unknown) => void) => {
    try {
      cb(null, mockGitConfig(workingDir))
    } catch (err) {
      cb(err as Error, null)
    }
  },
}))

vi.mock('find-up', () => ({
  findUp: (...args: unknown[]): unknown => mockFindUp(...args),
}))

vi.mock('git-repo-info', () => ({
  default: (): unknown => mockGitRepoInfo(),
}))

vi.mock('../../../src/utils/command-helpers.js', () => ({
  log: vi.fn(),
}))

describe('getRepoData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUp.mockResolvedValue('/test/.git')
    mockGitRepoInfo.mockReturnValue({ branch: 'main' })
  })

  it('parses GitHub SSH URLs', async () => {
    mockGitConfig.mockReturnValue({ remote: { origin: { url: 'git@github.com:ownername/test.git' } } })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toEqual({
      name: 'test',
      owner: 'ownername',
      repo: 'ownername/test',
      url: 'git@github.com:ownername/test.git',
      branch: 'main',
      provider: 'github',
      httpsUrl: 'https://github.com/ownername/test',
    })
  })

  it('parses GitLab SSH URLs', async () => {
    mockGitConfig.mockReturnValue({ remote: { origin: { url: 'git@gitlab.com:ownername/test.git' } } })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toEqual({
      name: 'test',
      owner: 'ownername',
      repo: 'ownername/test',
      url: 'git@gitlab.com:ownername/test.git',
      branch: 'main',
      provider: 'gitlab',
      httpsUrl: 'https://gitlab.com/ownername/test',
    })
  })

  it('parses GitHub HTTPS URLs', async () => {
    mockGitConfig.mockReturnValue({ remote: { origin: { url: 'https://github.com/ownername/test.git' } } })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toMatchObject({
      provider: 'github',
      repo: 'ownername/test',
      httpsUrl: 'https://github.com/ownername/test',
    })
  })

  it('parses GitLab HTTPS URLs', async () => {
    mockGitConfig.mockReturnValue({ remote: { origin: { url: 'https://gitlab.com/ownername/test.git' } } })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toMatchObject({
      provider: 'gitlab',
      repo: 'ownername/test',
      httpsUrl: 'https://gitlab.com/ownername/test',
    })
  })

  it('uses host as provider for unknown Git hosts', async () => {
    mockGitConfig.mockReturnValue({
      remote: { origin: { url: 'git@custom-git.example.com:user/test.git' } },
    })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toMatchObject({
      provider: 'custom-git.example.com',
      repo: 'user/test',
      httpsUrl: 'https://custom-git.example.com/user/test',
    })
  })

  it('uses the specified remote name when provided', async () => {
    mockGitConfig.mockReturnValue({
      remote: {
        origin: { url: 'git@github.com:owner/origin-repo.git' },
        upstream: { url: 'git@gitlab.com:owner/upstream-repo.git' },
      },
    })

    const result = await getRepoData({ workingDir: '/test', remoteName: 'upstream' })

    expect(result).toMatchObject({
      provider: 'gitlab',
      repo: 'owner/upstream-repo',
    })
  })

  it('returns an error when no Git remote is found', async () => {
    mockFindUp.mockResolvedValue(undefined)
    mockGitConfig.mockReturnValue({ remote: {} })

    const result = await getRepoData({ workingDir: '/test' })

    expect(result).toEqual({ error: 'No Git remote found' })
  })

  it('returns an error when the requested remote is not defined', async () => {
    mockGitConfig.mockReturnValue({ remote: { origin: { url: 'git@github.com:owner/repo.git' } } })

    const result = await getRepoData({ workingDir: '/test', remoteName: 'missing' })

    expect(result).toEqual({
      error:
        'The specified remote "missing" is not defined in Git repo. Please use --git-remote-name flag to specify a remote.',
    })
  })
})
