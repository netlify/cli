import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { callCli } from './call-cli.js'

const SITE_IDS_FILE = join(process.cwd(), '.netlify-test-site-ids')

export const generateSiteName = function (prefix: string) {
  const randomString = Math.random()
    .toString(BASE_36)
    .replace(/[^a-z]+/g, '')
    .slice(0, RANDOM_SITE_LENGTH)
  return `${prefix}${randomString}`
}

const BASE_36 = 36
const RANDOM_SITE_LENGTH = 8

const listAccounts = async () => {
  return JSON.parse((await callCli(['api', 'listAccountsForUser'])) as string) as { slug: string }[]
}

export const createLiveTestSite = async function (siteName: string) {
  console.log(`Creating new project for tests: ${siteName}`)
  const accounts = await listAccounts()
  if (!Array.isArray(accounts) || accounts.length <= 0) {
    throw new Error(`Can't find suitable account to create a project`)
  }
  const testAccountSlug = process.env.NETLIFY_TEST_ACCOUNT_SLUG ?? ''
  const account = testAccountSlug !== '' ? accounts.find(({ slug }) => slug === testAccountSlug) : accounts[0]
  if (account === undefined) {
    throw new Error(
      testAccountSlug !== ''
        ? `could not find account with slug ${testAccountSlug}`
        : 'user has no associated accounts',
    )
  }
  const accountSlug = account.slug
  console.log(`Using account ${accountSlug} to create project: ${siteName}`)
  const cliResponse = (await callCli(['sites:create', '--name', siteName, '--account-slug', accountSlug])) as string

  const isProjectCreated = cliResponse.includes('Project Created')
  if (!isProjectCreated) {
    throw new Error(`Failed creating project: ${cliResponse}`)
  }

  const { default: stripAnsi } = await import('strip-ansi')

  const matches = /Project ID:\s+([a-zA-Z\d-]+)/m.exec(stripAnsi(cliResponse))
  if (matches && Object.prototype.hasOwnProperty.call(matches, 1) && matches[1]) {
    const [, siteId] = matches
    console.log(`Done creating project ${siteName} for account '${accountSlug}'. Project Id: ${siteId}`)
    appendFileSync(SITE_IDS_FILE, `${siteId}\n`)
    return { siteId, account }
  }

  throw new Error(`Failed creating project: ${cliResponse}`)
}
