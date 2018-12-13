// A simple ghauth inspired library for getting a personal access token
const kit = require('@octokit/rest')
const inquirer = require('inquirer')
const get = require('lodash.get')

module.exports = createGithubPAT

async function createGithubPAT(opts) {
  opts = Object.assign(
    {
      userAgent: 'Netlify-cli-octokit',
      note: 'Netlify-cli-gh-auth',
      scopes: []
    },
    opts
  )
  const octokit = kit() // function local client

  const { username, password } = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Your GitHub username:',
      filter: input => input.trim()
    },
    {
      type: 'password',
      name: 'password',
      message: 'Your GitHub password:',
      mask: '*',
      filter: input => input.trim()
    }
  ])

  // configure basic auth
  octokit.authenticate({
    type: 'basic',
    username,
    password
  })

  let response
  try {
    response = await octokit.oauthAuthorizations.createAuthorization({
      note: opts.note + ' (' + new Date().toJSON() + ')',
      scopes: opts.scopes,
      headers: {
        'User-Agent': opts.userAgent
      }
    })
  } catch (e) {
    var otpHeader = e.headers['x-github-otp']
    if (otpHeader && otpHeader.includes('required')) {
      const { otp } = await inquirer.prompt([
        {
          type: 'input',
          name: 'otp',
          message: 'Your GitHub OTP/2FA Code:',
          filter: input => input.trim()
        }
      ])
      response = await octokit.oauthAuthorizations.createAuthorization({
        note: opts.note + ' (' + new Date().toJSON() + ')',
        scopes: opts.scopes,
        headers: {
          'x-github-otp': otp || null,
          'User-Agent': opts.userAgent
        }
      })
    } else {
      throw e
    }
  }

  if (get(response, 'data.token')) {
    return { user: username, token: get(response, 'data.token') }
  } else {
    const error = new Error('Github authentication failed')
    error.response = response
    throw error
  }
}
