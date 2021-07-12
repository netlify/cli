const test = require('ava')

const { parseRepoURL } = require('./read-repo-url')

test('parseRepoURL: should parse GitHub URL', (t) => {
  const url = new URL('https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware')
  // parseRepoURL expects the result of url.parse
  const [repo, contentPath] = parseRepoURL('GitHub', { path: url.pathname })

  t.is(repo, 'netlify-labs/all-the-functions')
  t.is(contentPath, 'functions/9-using-middleware')
})

test('parseRepoURL: should fail on GitLab URL', (t) => {
  const url = new URL('https://gitlab.com/netlify-labs/all-the-functions/-/blob/master/functions/9-using-middleware')
  t.throws(() => parseRepoURL('GitLab', { path: url.pathname }), { message: 'Unsupported host GitLab' })
})
