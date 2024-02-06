// A simple ghauth inspired library for getting a personal access token
import http from 'http'
import process from 'process'

import { Octokit } from '@octokit/rest'
import getPort from 'get-port'
import inquirer from 'inquirer'

import { log } from './command-helpers.js'
import createDeferred from './create-deferred.js'
import openBrowser from './open-browser.js'

const SERVER_PORT = 3000

/**
 * @typedef Token
 * @type {object}
 * @property {string} user - The username that is associated with the token
 * @property {string} token - The actual token value starting with `gho_`
 * @property {string} provider - The Provider where the token is associated with ('github').
 */

const promptForAuthMethod = async () => {
  const authChoiceNetlify = 'Authorize with GitHub through app.netlify.com'
  const authChoiceToken = 'Authorize with a GitHub personal access token'
  const authChoices = [authChoiceNetlify, authChoiceToken]

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

/**
 * Authenticate with the netlify app
 * @returns {Promise<Token>} Returns a Promise with a token object
 */
export const authWithNetlify = async () => {
  const port = await getPort({ port: SERVER_PORT })
  const { promise: deferredPromise, reject: deferredReject, resolve: deferredResolve } = createDeferred()

  const server = http.createServer(function onRequest(req, res) {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    const parameters = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1))
    if (parameters.get('token')) {
      // @ts-expect-error TS(2722) FIXME: Cannot invoke an object which is possibly 'undefin... Remove this comment to see the full error message
      deferredResolve(Object.fromEntries(parameters))
      res.end(
        `${
          "<html><head><script>if(history.replaceState){history.replaceState({},'','/')}</script><style>html{font-family:sans-serif;background:rgb(18 24 31)}body{overflow:hidden;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;width:100vw;}h3{margin:0}.card{position:relative;display:flex;flex-direction:column;width:75%;max-width:364px;padding:24px;background:white;color:rgb(18 24 31);border-radius:8px;box-shadow:0 2px 4px 0 rgb(18 24 31 / 16%);}</style></head>" +
          "<body><div class=card><h3>Logged In</h3><p>You're now logged into Netlify CLI with your "
        }${parameters.get('provider')} credentials. Please close this window.</p></div>`,
      )
      server.close()
      return
    }
    res.end('BAD PARAMETERS')
    server.close()
    // @ts-expect-error TS(2722) FIXME: Cannot invoke an object which is possibly 'undefin... Remove this comment to see the full error message
    deferredReject(new Error('Got invalid parameters for CLI login'))
  })

  await new Promise(function waitForListening(resolve, reject) {
    server.on('error', reject)
    // @ts-expect-error TS(2769) FIXME: No overload matches this call.
    server.listen(port, resolve)
  })

  const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'
  const urlParams = new URLSearchParams({
    host: `http://localhost:${port}`,
    provider: 'github',
  })
  const url = `${webUI}/cli?${urlParams.toString()}`

  // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: string; }' is not assigna... Remove this comment to see the full error message
  await openBrowser({ url })

  return deferredPromise
}

const getPersonalAccessToken = async () => {
  const { token } = await inquirer.prompt([
    {
      type: 'input',
      name: 'token',
      message: 'Your GitHub personal access token:',
      filter: (input) => input.trim(),
    },
  ])

  return { token }
}

/**
 * Authenticate with the netlify app
 * @returns {Promise<Token>} Returns a Promise with a token object
 */
const authWithToken = async () => {
  const { token } = await getPersonalAccessToken()
  if (!token) {
    throw new Error('GitHub authentication failed')
  }

  const octokit = new Octokit({ auth: `token ${token}` })
  // @ts-expect-error TS(2339) FIXME: Property 'login' does not exist on type 'OctokitRe... Remove this comment to see the full error message
  const { login: user } = await octokit.users.getAuthenticated()

  return { token, user, provider: 'github' }
}

/**
 * Get a GitHub token
 * @returns {Promise<Token>} Returns a Promise with a token object
 */
export const getGitHubToken = async () => {
  log('')

  const withNetlify = await promptForAuthMethod()

  return withNetlify ? await authWithNetlify() : await authWithToken()
}
