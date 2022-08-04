// @ts-check
const { Buffer } = require('buffer')

const { OneGraphClient } = require('netlify-onegraph-internal')
const { v4: uuidv4 } = require('uuid')

const { OneGraphCliClient, ensureCLISession } = require('../../lib/one-graph/cli-client')
const { getNetlifyGraphConfig } = require('../../lib/one-graph/cli-netlify-graph')
const { NETLIFYDEVERR, chalk, error, exit, getToken, log } = require('../../utils')
const { msg } = require('../login/login')

const { ensureAppForSite, executeCreateApiTokenMutation } = OneGraphCliClient

/**
 * Creates the `netlify graph:init` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphInit = async (options, command) => {
  const { api, site, state } = command.netlify
  const siteId = site.id

  if (!siteId) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }

  let [netlifyToken, loginLocation] = await getToken()
  if (!netlifyToken) {
    netlifyToken = await command.authenticate()
  }

  let siteData = null
  try {
    // @ts-ignore: we need better types for our api object
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    if (netlifyToken && error_.status === 401) {
      log(`Already logged in ${msg(loginLocation)}`)
      log()
      log(`Run ${chalk.cyanBright('netlify status')} for account details`)
      log()
      log(`or run ${chalk.cyanBright('netlify switch')} to switch accounts`)
      log()
      log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
      log()
      return exit()
    }
    throw error_
  }

  if (netlifyToken == null) {
    error(
      `${NETLIFYDEVERR} Error: Unable to start Netlify Graph without a login. To enable, run ${chalk.yellow(
        'netlify login',
      )} first`,
    )
    return exit()
  }

  await ensureAppForSite(netlifyToken, siteId)

  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  await ensureCLISession({
    metadata: {},
    netlifyToken,
    site,
    state,
    netlifyGraphConfig,
  })

  let envChanged = false

  // Get current environment variables set in the UI
  const {
    build_settings: { env = {} },
  } = siteData

  const newEnv = {
    ...env,
  }

  if (!env.NETLIFY_GRAPH_WEBHOOK_SECRET) {
    envChanged = true
    const secret = Buffer.from(uuidv4()).toString('base64')
    newEnv.NETLIFY_GRAPH_WEBHOOK_SECRET = secret
  }

  if (!env.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN) {
    const variables = {
      input: {
        appId: siteId,
        scopes: ['MODIFY_SCHEMA', 'PERSIST_QUERY'],
      },
    }

    const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
    const result = await executeCreateApiTokenMutation(variables, {
      siteId,
      accessToken: jwt,
    })

    const token =
      result.data &&
      result.data.oneGraph &&
      result.data.oneGraph.createApiToken &&
      result.data.oneGraph.createApiToken.accessToken &&
      result.data.oneGraph.createApiToken.accessToken.token

    if (token) {
      envChanged = true
      newEnv.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN = token
    } else {
      error(`Unable to create Netlify Graph persist query token: ${JSON.stringify(result.errors, null, 2)}`)
    }
  }

  if (envChanged) {
    // Apply environment variable updates
    // @ts-ignore
    await api.updateSite({
      siteId,
      body: {
        build_settings: {
          env: newEnv,
        },
      },
    })

    log(`Finished updating Graph-related environment variables for site ${siteData.name}`)
  }
}

/**
 * Creates the `netlify graph:init` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphInitCommand = (program) =>
  program
    .command('graph:init')
    .description('Initialize all the resources for Netlify Graph')
    .action(async (options, command) => {
      await graphInit(options, command)
    })

module.exports = { createGraphInitCommand }
