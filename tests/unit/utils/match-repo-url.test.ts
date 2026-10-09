import { describe, expect, it } from 'vitest'

import { matchesRepoUrl } from '../../../src/utils/match-repo-url.js'

describe('matchesRepoUrl', () => {
  it('does not match when there is no stored repo_url', () => {
    expect(matchesRepoUrl('https://github.com/test/repo', undefined)).toBe(false)
  })

  it('does not match a stored repo_url from a different owner or repo', () => {
    expect(matchesRepoUrl('https://github.com/test/repo', 'https://github.com/other/repo')).toBe(false)
  })

  it('matches an SSH remote URL against a bare `owner/repo` stored value', () => {
    expect(matchesRepoUrl('git@git.example-host.internal:acme/widget.git', 'acme/widget')).toBe(true)
  })

  it('matches an HTTPS remote URL against a bare `owner/repo` stored value', () => {
    expect(matchesRepoUrl('https://git.example-host.internal/acme/widget.git', 'acme/widget')).toBe(true)
  })

  it('matches when the bare `owner/repo` stored value has a `.git` suffix', () => {
    expect(matchesRepoUrl('git@git.example-host.internal:acme/widget.git', 'acme/widget.git')).toBe(true)
  })

  it('does not match a bare `owner/repo` stored value for a different owner/repo', () => {
    expect(matchesRepoUrl('git@git.example-host.internal:acme/widget.git', 'someone-else/widget')).toBe(false)
  })

  it('matches independently of case', () => {
    expect(matchesRepoUrl('git@git.example-host.internal:Acme/Widget.git', 'acme/widget')).toBe(true)
  })

  it('does not match a full stored URL on a different host with the same owner/repo', () => {
    expect(matchesRepoUrl('git@gitlab.com:acme/widget.git', 'https://git.example-host.internal/acme/widget')).toBe(
      false,
    )
  })

  it('matches full URLs across `.git` suffix and protocol differences', () => {
    expect(matchesRepoUrl('git@github.com:vibecoder/my-unicorn.git', 'https://github.com/vibecoder/my-unicorn')).toBe(
      true,
    )
  })
})
