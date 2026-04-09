import { describe, expect, it, vi } from 'vitest'

import { normalizeRepoUrl } from '../../..//src/utils/normalize-repo-url.js'

vi.mock('../../../../src/utils/command-helpers.js')

describe('normalizeRepoUrl', () => {
  it('returns GitHub URLs given `owner/repo` format', () => {
    const result = normalizeRepoUrl('vibecoder/my-unicorn')

    expect(result).toEqual({
      repoUrl: 'git@github.com:vibecoder/my-unicorn.git',
      httpsUrl: 'https://github.com/vibecoder/my-unicorn',
      repoName: 'my-unicorn',
    })
  })

  it('returns a GitHub HTTPS URL as is for `repoUrl` and for `httpsUrl`', () => {
    const result = normalizeRepoUrl('https://github.com/vibecoder/my-unicorn')

    expect(result).toEqual({
      repoUrl: 'https://github.com/vibecoder/my-unicorn',
      httpsUrl: 'https://github.com/vibecoder/my-unicorn',
      repoName: 'my-unicorn',
    })
  })

  it('returns a GitHub HTTPS URL with .git extension as is for `repoUrl` and without `.git` for `httpsUrl`', () => {
    const result = normalizeRepoUrl('https://github.com/vibecoder/my-unicorn.git')

    expect(result).toEqual({
      repoUrl: 'https://github.com/vibecoder/my-unicorn.git',
      httpsUrl: 'https://github.com/vibecoder/my-unicorn',
      repoName: 'my-unicorn',
    })
  })

  it('returns a GitHub SSH URL as is for `repoUrl` and with `https` protocol for `httpsUrl`', () => {
    const result = normalizeRepoUrl('git@github.com:vibecoder/my-unicorn.git')

    expect(result).toEqual({
      repoUrl: 'git@github.com:vibecoder/my-unicorn.git',
      httpsUrl: 'https://github.com/vibecoder/my-unicorn',
      repoName: 'my-unicorn',
    })
  })

  it('throws an error given an invalid repository URL', () => {
    expect(() => normalizeRepoUrl('invalid-repo')).toThrow('Invalid repository URL: invalid-repo')
  })

  it('throws an error given a URL without owner or repo', () => {
    expect(() => normalizeRepoUrl('https://github.com/')).toThrow('Invalid repository URL: https://github.com/')
  })

  it('throws an error given a URL without a repo', () => {
    expect(() => normalizeRepoUrl('https://github.com/vibecoder')).toThrow(
      'Invalid repository URL: https://github.com/vibecoder',
    )
  })
})
