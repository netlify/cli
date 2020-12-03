// A simple ghauth inspired library for getting a personal access token
const http = require('http')
const os = require('os')
const process = require('process')
const querystring = require('querystring')

const { Octokit } = require('@octokit/rest')
const dotProp = require('dot-prop')
const getPort = require('get-port')
const inquirer = require('inquirer')

const { version } = require('../../package.json')

const { createDeferred } = require('./deferred')
const openBrowser = require('./open-browser')

const SERVER_PORT = 3000
const USER_AGENT = `Netlify CLI ${version}`

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

const promptForAuthMethod = async () => {
  const authChoiceNetlify = 'Authorize with GitHub through app.netlify.com'
  const authChoiceManual = 'Enter your GitHub credentials manually'
  const authChoices = [authChoiceNetlify, authChoiceManual]

  const { authMethod } = await inquirer.prompt([
    {
      type: 'list',
      name: 'authMethod',
      message:
        'Netlify CLI needs access to your GitHub account to configure Webhooks and Deploy Keys. ' +
        'What would you like to do?',
      choices: authChoices,
    },
  ])

  return authMethod === authChoiceNetlify
}

const authWithNetlify = async ({ log }) => {
  const port = await getPort({ port: SERVER_PORT })
  const { promise: deferredPromise, reject: deferredReject, resolve: deferredResolve } = createDeferred()

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

const getUsernameAndPassword = async () => {
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

  return { username, password }
}

const getGitHubClient = ({ username, password }) => {
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
  return octokit
}

const createAuthorization = async ({ octokit }) => {
  const response = await octokit.oauthAuthorizations.createAuthorization({
    note: `Netlify CLI ${os.userInfo().username}@${os.hostname()} (${new Date().toJSON()})`,
    note_url: 'https://cli.netlify.com/',
    scopes: ['admin:org', 'admin:public_key', 'repo', 'user'],
    headers: {
      'User-Agent': USER_AGENT,
    },
  })
  return response
}

const authManually = async () => {
  const { username, password } = await getUsernameAndPassword()
  const octokit = getGitHubClient({ username, password })
  const response = await createAuthorization(octokit)
  const token = dotProp.get(response, 'data.token')
  if (token) {
    return { user: username, token }
  }
  const error = new Error('Github authentication failed')
  error.response = response
  throw error
}

module.exports = async function getGitHubToken({ log }) {
  log('')

  const withNetlify = await promptForAuthMethod()
  if (withNetlify) {
    return await authWithNetlify({ log })
  }

  await authManually()
}
