import { describe, expect, test } from 'vitest'

import { isNetlifyGitUrl, isSameRepository } from '../../../src/utils/netlify-git.js'

describe('isNetlifyGitUrl', () => {
  test.each([
    ['https://git.netlify.com/team/site.git', true],
    ['https://hgit.services-prod.nsvcs.net/abc123', true],
    ['https://github.com/team/site.git', false],
    ['https://git.netlify.com.evil.example/team/site.git', false],
    ['git@github.com:team/site.git', false],
    ['not a url', false],
  ])('%s → %s', (url, expected) => {
    expect(isNetlifyGitUrl(url)).toBe(expected)
  })
})

describe('isSameRepository', () => {
  test.each([
    ['https://github.com/team/site.git', 'https://github.com/team/site', true],
    ['git@github.com:team/site.git', 'https://github.com/Team/Site', true],
    ['ssh://git@github.com/team/site.git', 'https://x-access-token:t@github.com/team/site/', true],
    ['/srv/repos/site.git', 'file:///srv/repos/site', true],
    ['https://github.com/team/site', 'https://github.com/team/other', false],
    ['https://github.com/team/site', 'https://gitlab.com/team/site', false],
    ['https://github.com/team/site', 'https://github.com/other/team/site', false],
    ['not a url', 'not a url', false],
  ])('%s and %s → %s', (a, b, expected) => {
    expect(isSameRepository(a, b)).toBe(expected)
  })
})
