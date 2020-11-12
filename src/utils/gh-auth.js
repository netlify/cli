// A simple ghauth inspired library for getting a personal access token
const http = require('http')
const process = require('process')
const querystring = require('querystring')

const { Octokit } = require('@octokit/rest')
const getPort = require('get-port')
const inquirer = require('inquirer')
const get = require('lodash/get')

const openBrowser = require('./open-browser')

const SERVER_PORT = 3000

module.exports = async function getGitHubToken({ opts, log }) {
  log('')

  opts = {
    userAgent: 'Netlify-cli-octokit',
    note: 'Netlify-cli-gh-auth',
    scopes: [],
    ...opts,
  }

  const promptForOTP = async function () {
    const { otp } = await inquirer.prompt([
      {
        type: 'input',
        name: 'otp',
        message: 'Your GitHub OTP/2FA Code:',
        filter: (input) => input.trim(),
      },
    ])
    return otp
  }

  const authChoiceNetlify = 'Authorize with GitHub through app.netlify.com'
  const authChoiceManual = 'Enter your GitHub credentials manually'
  const authChoices = [authChoiceNetlify, authChoiceManual]

  const { initChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'initChoice',
      message:
        'Netlify CLI needs access to your GitHub account to configure Webhooks and Deploy Keys. ' +
        'What would you like to do?',
      choices: authChoices,
    },
  ])

  if (initChoice === authChoiceNetlify) {
    const port = await getPort({ port: SERVER_PORT })
    let deferredResolve
    let deferredReject
    const deferredPromise = new Promise(function deferred(resolve, reject) {
      deferredResolve = resolve
      deferredReject = reject
    })

    const server = http.createServer(function onRequest(req, res) {
      const parameters = querystring.parse(req.url.slice(req.url.indexOf('?') + 1))
      if (parameters.token) {
        deferredResolve(parameters)
        res.end(
          `${
            "<html><head><script>if(history.replaceState){history.replaceState({},'','/')}</script><style>html{font-family:sans-serif;background:#0e1e25}body{overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100vw;}h3{margin:0}.card{position:relative;display:flex;flex-direction:column;width:75%;max-width:364px;padding:24px;background:white;color:rgb(14,30,37);border-radius:8px;box-shadow:0 2px 4px 0 rgba(14,30,37,.16);}</style></head>" +
            "<body><div class=card><h3>Logged In</h3><p>You're now logged into Netlify CLI with your "
          }${parameters.provider} credentials. Please close this window.</p></div>`,
        )
        server.close()
        return
      }
      res.end('BAD PARAMETERS')
      server.close()
      deferredReject(new Error('Got invalid parameters for CLI login'))
    })

    await new Promise(function waitForListening(resolve, reject) {
      server.on('error', reject)
      server.listen(port, resolve)
    })

    const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
    const url = `${webUI}/cli?${querystring.encode({
      host: `http://localhost:${port}`,
      provider: 'github',
    })}`

    await openBrowser({ url, log })

    return deferredPromise
  }
  const { username, password } = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Your GitHub username:',
      filter: (input) => input.trim(),
    },
    {
      type: 'password',
      name: 'password',
      message: 'Your GitHub password:',
      mask: '*',
      filter: (input) => input.trim(),
    },
  ])

  // configure basic auth
  const octokit = new Octokit({
    auth: {
      username,
      password,
      on2fa() {
        return promptForOTP()
      },
    },
  })

  const response = await octokit.oauthAuthorizations.createAuthorization({
    note: `${opts.note} (${new Date().toJSON()})`,
    note_url: 'https://cli.netlify.com/',
    scopes: opts.scopes,
    headers: {
      'User-Agent': opts.userAgent,
    },
  })

  if (get(response, 'data.token')) {
    return { user: username, token: get(response, 'data.token') }
  }
  const error = new Error('Github authentication failed')
  error.response = response
  throw error
}
