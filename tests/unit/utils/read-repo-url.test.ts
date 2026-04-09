import { describe, expect, test } from 'vitest'

import { parseRepoURL } from '../../../src/utils/read-repo-url.js'

describe('parseRepoURL', () => {
  test('should parse GitHub URL', () => {
    const url = new URL('https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware')
    // parseRepoURL expects the result of url.parse
    const [repo, contentPath] = parseRepoURL('GitHub', { path: url.pathname })

    expect(repo).toBe('netlify-labs/all-the-functions')
    expect(contentPath).toBe('functions/9-using-middleware')
  })

  test('should fail on GitLab URL', () => {
    const url = new URL('https://gitlab.com/netlify-labs/all-the-functions/-/blob/master/functions/9-using-middleware')
    expect(() => parseRepoURL('GitLab', { path: url.pathname })).toThrowError('Unsupported host GitLab')
  })
})
