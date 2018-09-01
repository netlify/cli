// A simple ghauth inspired library for getting a personal access token
const kit = require('@octokit/rest')
const inquirer = require('inquirer')

module.exports = createGithubPAT

async function createGithubPAT(opts) {
  opts = Object.assign(
    {
      userAgent: 'Netlify cli octokit',
      note: 'Netlify cli gh-auth'
    },
    opts
  )
  const octokit = kit()

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

  const response = await octokit.apps.get({
    note: opts.note + ' (' + new Date().toJSON() + ')',
    scopes: opts.scopes,
    headers: {
      'User-Agent': opts.userAgent
    }
  })

  console.log(response)
  if (response.token) return { user: response.user, token: response.token }

  const otpPrompt = []
  var otpHeader = response.headers['x-github-otp']
  if (otpHeader && otpHeader.includes('required')) {
    otpPrompt.push({
      type: 'input',
      name: 'otp',
      message: 'Your GitHub OTP/2FA Code:',
      filter: input => input.trim()
    })
  }

  const { otp } = await inquirer.prompt(otpPrompt)

  const otpResponse = await octokit.authorization.create({
    note: opts.note + ' (' + new Date().toJSON() + ')',
    scopes: opts.scopes,
    headers: {
      'x-github-otp': otp || null,
      'User-Agent': opts.userAgent
    }
  })

  console.log(otpResponse)
  if (otpResponse.token) return { user: otpResponse.user, token: otpResponse.token }
}
