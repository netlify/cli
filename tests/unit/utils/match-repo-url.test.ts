import { describe, expect, it } from 'vitest'

import { parseRepoUrl, siteMatchesRepoUrl } from '../../../src/utils/match-repo-url.js'
import type { SiteInfo } from '../../../src/utils/types.js'

const siteWithRepo = (provider: string, repoUrl?: string) =>
  ({ id: 'site', name: 'site', build_settings: { provider, repo_url: repoUrl } }) as unknown as SiteInfo

describe('parseRepoUrl', () => {
  it.each([
    ['https://GitHub.com/Acme/Widget.git/', { host: 'github.com', path: 'Acme/Widget' }],
    ['git@gitlab.example.com:acme/widget.git', { host: 'gitlab.example.com', path: 'acme/widget' }],
    ['ssh://git@github.com:22/acme/widget.git', { host: 'github.com', path: 'acme/widget' }],
    ['https://token@gitlab.com/group/subgroup/widget', { host: 'gitlab.com', path: 'group/subgroup/widget' }],
    ['acme/widget', { host: undefined, path: 'acme/widget' }],
  ])('parses %s', (url, expected) => {
    expect(parseRepoUrl(url)).toEqual(expected)
  })

  it.each(['', 'https://github.com/', 'https://exa mple.com/acme/widget'])('rejects %j', (url) => {
    expect(parseRepoUrl(url)).toBeUndefined()
  })
})

describe('siteMatchesRepoUrl', () => {
  it('does not match when there is no stored repo_url', () => {
    expect(siteMatchesRepoUrl(siteWithRepo('github'), 'https://github.com/test/repo')).toBe(false)
  })

  it('does not match a stored repo_url from a different owner or repo', () => {
    expect(
      siteMatchesRepoUrl(siteWithRepo('github', 'https://github.com/other/repo'), 'https://github.com/test/repo'),
    ).toBe(false)
  })

  it('matches full URLs across `.git` suffix, protocol and case differences', () => {
    expect(
      siteMatchesRepoUrl(
        siteWithRepo('github', 'https://github.com/vibecoder/my-unicorn'),
        'git@github.com:VibeCoder/my-unicorn.git',
      ),
    ).toBe(true)
  })

  it('does not match the same owner/repo on a different host', () => {
    expect(
      siteMatchesRepoUrl(
        siteWithRepo('manual', 'https://git.example-host.internal/acme/widget'),
        'git@gitlab.com:acme/widget.git',
      ),
    ).toBe(false)
  })

  it('matches a manual bare `owner/repo` stored value against a remote on any host', () => {
    expect(
      siteMatchesRepoUrl(siteWithRepo('manual', 'acme/widget'), 'git@git.example-host.internal:acme/widget.git'),
    ).toBe(true)
    expect(
      siteMatchesRepoUrl(siteWithRepo('manual', 'acme/widget.git'), 'https://git.example-host.internal/acme/widget'),
    ).toBe(true)
  })

  it('does not treat a bare `owner/repo` stored value as host-agnostic for non-manual providers', () => {
    expect(
      siteMatchesRepoUrl(siteWithRepo('github', 'acme/widget'), 'git@git.example-host.internal:acme/widget.git'),
    ).toBe(false)
  })

  it('matches a bare `owner/repo` remote only against a bare manual stored value', () => {
    expect(siteMatchesRepoUrl(siteWithRepo('manual', 'acme/widget'), 'acme/widget')).toBe(true)
    expect(siteMatchesRepoUrl(siteWithRepo('manual', 'https://github.com/acme/widget'), 'acme/widget')).toBe(false)
    expect(siteMatchesRepoUrl(siteWithRepo('github', 'https://github.com/acme/widget'), 'acme/widget')).toBe(false)
  })

  it('matches GitLab subgroup paths in full', () => {
    expect(
      siteMatchesRepoUrl(
        siteWithRepo('gitlab', 'https://gitlab.com/group/sub/widget'),
        'git@gitlab.com:group/other/widget.git',
      ),
    ).toBe(false)
  })
})
