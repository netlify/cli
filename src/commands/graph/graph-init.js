// @ts-check
const { Buffer } = require('buffer')

const { v4: uuidv4 } = require('uuid')

const { OneGraphCliClient, ensureCLISession } = require('../../lib/one-graph/cli-client')
const { NETLIFYDEVERR, chalk, error, log } = require('../../utils')

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

  if (!site.id) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }

  const netlifyToken = await command.authenticate()
  // @ts-ignore
  const siteData = await api.getSite({ siteId })

  await ensureAppForSite(netlifyToken, siteId)

  await ensureCLISession({
    metadata: {},
    netlifyToken,
    site,
    state,
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

  envChanged = true
  const variables = {
    nfToken: netlifyToken,
    input: {
      appId: siteId,
      scopes: ['MODIFY_SCHEMA', 'PERSIST_QUERY'],
    },
  }

  const result = await executeCreateApiTokenMutation(variables, {
    siteId,
  })

  const token =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createApiToken &&
    result.data.oneGraph.createApiToken.accessToken &&
    result.data.oneGraph.createApiToken.accessToken.token

  if (token) {
    newEnv.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN = token
  } else {
    error(`Unable to create Netlify Graph persist query token: ${JSON.stringify(result.errors, null, 2)}`)
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
