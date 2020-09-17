const stripAnsi = require('strip-ansi')
const callCli = require('./callCli')

function generateSiteName(prefix) {
  const randomString = Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, '')
    .substr(0, 8)
  return `${prefix}${randomString}`
}

async function listAccounts() {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

async function createLiveTestSite(siteName) {
  console.log(`Creating new site for tests: ${siteName}`)
  const accounts = await listAccounts()
  if (!Array.isArray(accounts) || accounts.length <= 0) {
    throw new Error(`Can't find suitable account to create a site`)
  }
  const accountSlug = accounts[0].slug
  console.log(`Using account ${accountSlug} to create site: ${siteName}`)
  const cliResponse = await callCli(['sites:create', '--name', siteName, '--account-slug', accountSlug])

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

module.exports = { generateSiteName, createLiveTestSite }
