const {
  env: { NETLIFY_TEST_ACCOUNT_SLUG },
} = require('process')

const callCli = require('./call-cli.cjs')

const generateSiteName = function (prefix) {
  const randomString = Math.random()
    .toString(BASE_36)
    .replace(/[^a-z]+/g, '')
    .slice(0, RANDOM_SITE_LENGTH)
  return `${prefix}${randomString}`
}

const BASE_36 = 36
const RANDOM_SITE_LENGTH = 8

const listAccounts = async function () {
  return JSON.parse(await callCli(['api', 'listAccountsForUser']))
}

const createLiveTestSite = async function (siteName) {
  console.log(`Creating new site for tests: ${siteName}`)
  const accounts = await listAccounts()
  if (!Array.isArray(accounts) || accounts.length <= 0) {
    throw new Error(`Can't find suitable account to create a site`)
  }
  const account = NETLIFY_TEST_ACCOUNT_SLUG
    ? accounts.find(({ slug }) => slug === NETLIFY_TEST_ACCOUNT_SLUG)
    : accounts[0]
  const accountSlug = account.slug
  console.log(`Using account ${accountSlug} to create site: ${siteName}`)
  const cliResponse = await callCli(['sites:create', '--name', siteName, '--account-slug', accountSlug])

  const isSiteCreated = /Site Created/.test(cliResponse)
  if (!isSiteCreated) {
    throw new Error(`Failed creating site: ${cliResponse}`)
  }

  const { default: stripAnsi } = await import('strip-ansi')

  const matches = /Site ID:\s+([a-zA-Z\d-]+)/m.exec(stripAnsi(cliResponse))
  if (matches && Object.prototype.hasOwnProperty.call(matches, 1) && matches[1]) {
    const [, siteId] = matches
    console.log(`Done creating site ${siteName} for account '${accountSlug}'. Site Id: ${siteId}`)
    return { siteId, account }
  }

  throw new Error(`Failed creating site: ${cliResponse}`)
}

module.exports = { generateSiteName, createLiveTestSite }
