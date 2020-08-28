const stripAnsi = require('strip-ansi')
const callCli = require('./callCli')

async function createLiveTestSite(siteName, accountSlug, execOptions) {
  const cliResponse = await callCli(['sites:create', '--name', siteName, '--account-slug', accountSlug], execOptions)

  const isSiteCreated = /Site Created/.test(cliResponse)
  if (!isSiteCreated) {
    return null
  }

  const matches = /Site ID:\s+([a-zA-Z0-9-]+)/m.exec(stripAnsi(cliResponse))
  if (matches && Object.prototype.hasOwnProperty.call(matches, 1) && matches[1]) {
    return matches[1]
  }

  return null
}

module.exports = createLiveTestSite
