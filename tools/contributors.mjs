#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import process from 'process'

import { Octokit } from '@octokit/core'
import { paginateRest } from '@octokit/plugin-paginate-rest'

/**
 * Parses a contributor string into it's parts
 * @param {string} entry
 * @returns {name: string, email?: string, web?: string}
 */
const parseContributorString = (entry) => {
  let name, email, web

  const matchFull = /^(.+)\s<(.+)>\s\((.+)\)$/gm.exec(entry)
  const matchWeb = /^(.+)\s\((.+)\)$/gm.exec(entry)
  const matchMail = /^(.+)\s<(.+)>$/gm.exec(entry)
  if (matchFull) {
    ;[, name, email, web] = matchFull
  } else if (matchWeb) {
    ;[, name, web] = matchWeb
  } else if (matchMail) {
    ;[, name, email] = matchMail
  } else {
    name = entry
  }

  return { name, email, web }
}

/**
 * Generates a contributor string out of an entry
 * @param {object} entry
 * @param {string} entry.name
 * @param {string} [entry.email]
 * @param {string} [entry.web]
 * @returns
 */
const createContributorString = (entry) =>
  [entry.name, entry.email && `<${entry.email}>`, entry.web && `(${entry.web})`].filter(Boolean).join(' ')

// read the packageJSON
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
// parse the existing contributors
const existingContributors = packageJson.contributors.map((contributor) => parseContributorString(contributor))

// Get a list of email addresses from local git log as they are not
// part of the user information
const mailList = new Map(
  execSync(`git log --format='%an⏣%ae'`)
    .toString()
    .split('\n')
    .map((entry) => entry.split('⏣'))
    .filter(([key]) => !(key.length === 0 || key.includes('[bot]'))),
)

const [GITHUB_TOKEN] = process.argv.slice(2)

if (!GITHUB_TOKEN) {
  throw new Error('Please provide the GITHUB_TOKEN as argument to the command: node ./tools/contributors.mjs <token>')
}

const PagedOctokit = Octokit.plugin(paginateRest)
const octokit = new PagedOctokit({ auth: GITHUB_TOKEN })

const contributorList = await octokit.paginate('GET /repos/{owner}/{repo}/contributors', {
  per_page: 100,
  owner: 'netlify',
  repo: 'cli',
})

// get the user information for each contributor
const contributors = await Promise.all(
  contributorList
    .filter(({ type }) => type === 'User')
    .map((user) => octokit.request('GET /users/{username}', { username: user.login }).then(({ data }) => data)),
)

// generate a list of strings with name email and website
const packageJsonContributors = contributors.map((user) => {
  const web = (user.twitter_username && `https://twitter.com/${user.twitter_username}`) || user.blog
  let fullName = user.name || user.login
  let email = mailList.get(user.login) || mailList.get(user.name) || user.email

  if (!email) {
    const matchingName = [...mailList.keys()].find((name) => name.startsWith(user.name))
    if (matchingName) {
      fullName = matchingName
      email = mailList.get(matchingName)
    }
  }

  // Check if an existing user can be found if yes use the details provided in the package.json
  const existing = existingContributors.find(
    (cont) =>
      cont.name === fullName ||
      cont.name.startsWith(user.name) ||
      (cont.email && cont.email === email) ||
      (cont.web && cont.web === web),
  )

  if (existing) {
    return createContributorString(existing)
  }

  return createContributorString({ name: fullName, email, web })
})

packageJson.contributors = packageJsonContributors

writeFileSync('package.json', JSON.stringify(packageJson, null, 2), 'utf-8')
