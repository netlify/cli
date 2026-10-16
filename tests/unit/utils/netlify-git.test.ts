import { describe, expect, test } from 'vitest'

import { isNetlifyGitUrl } from '../../../src/utils/netlify-git.js'

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
