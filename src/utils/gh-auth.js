// A simple ghauth inspired library for getting a personal access token
const Octokit = require('@octokit/rest')
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


  async function promptForOTP () {
    const { otp } = await inquirer.prompt([
      {
        type: 'input',
        name: 'otp',
        message: 'Your GitHub OTP/2FA Code:',
        filter: input => input.trim()
      }
    ])
    return otp
  }


  // configure basic auth
  const octokit = new Octokit ({
    auth: {
      username,
      password,
      async on2fa () {
        return promptForOTP()
      }
    }
  })

  let response = await octokit.oauthAuthorizations.createAuthorization({
    note: opts.note + ' (' + new Date().toJSON() + ')',
    note_url: 'https://cli.netlify.com/',
    scopes: opts.scopes,
    headers: {
      'User-Agent': opts.userAgent
    }
  })

  if (get(response, 'data.token')) {
    return { user: username, token: get(response, 'data.token') }
  } else {
    const error = new Error('Github authentication failed')
    error.response = response
    throw error
  }
}
