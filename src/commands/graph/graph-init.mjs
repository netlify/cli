// @ts-check
import { Buffer } from 'buffer'
import process from 'process'

import { OneGraphClient } from 'netlify-onegraph-internal'
import { v4 as uuidv4 } from 'uuid'

import { OneGraphCliClient, ensureCLISession } from '../../lib/one-graph/cli-client.mjs'
import { getNetlifyGraphConfig } from '../../lib/one-graph/cli-netlify-graph.mjs'
import { NETLIFYDEVERR, chalk, error, exit, getToken, log } from '../../utils/command-helpers.mjs'
import { translateFromEnvelopeToMongo } from '../../utils/env/index.mjs'

const { ensureAppForSite, executeCreateApiTokenMutation } = OneGraphCliClient

/**
 * Creates the `netlify graph:init` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns
 */
const graphInit = async (options, command) => {
  const { api, config, site, siteInfo, state } = command.netlify
  const accountId = siteInfo.account_slug
  const siteId = site.id

  if (!siteId) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }

  let [netlifyToken] = await getToken()
  if (!netlifyToken) {
    netlifyToken = await command.authenticate()
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

  if (process.env.NODE_ENV !== 'test') {
    await ensureCLISession({
      config,
      metadata: {},
      netlifyToken,
      site,
      state,
      netlifyGraphConfig,
    })
  }

  let envChanged = false

  // Get current environment variables set in the UI
  let env = (siteInfo.build_settings && siteInfo.build_settings.env) || {}
  const isUsingEnvelope = siteInfo.use_envelope
  if (isUsingEnvelope) {
    const envelopeVariables = await api.getEnvVars({ accountId, siteId })
    env = translateFromEnvelopeToMongo(envelopeVariables)
  }

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

  if (!envChanged) {
    log(`Graph-related environment variables already set for site ${siteInfo.name}`)
    return true
  }

  // Apply environment variable updates

  // eslint-disable-next-line unicorn/prefer-ternary
  if (isUsingEnvelope) {
    await api.createEnvVars({
      accountId,
      siteId,
      body: [
        !env.NETLIFY_GRAPH_WEBHOOK_SECRET && {
          key: 'NETLIFY_GRAPH_WEBHOOK_SECRET',
          scopes: ['functions'],
          values: [{ context: 'all', value: newEnv.NETLIFY_GRAPH_WEBHOOK_SECRET }],
        },
        !env.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN && {
          key: 'NETLIFY_GRAPH_PERSIST_QUERY_TOKEN',
          scopes: ['builds', 'functions'],
          values: [{ context: 'all', value: newEnv.NETLIFY_GRAPH_PERSIST_QUERY_TOKEN }],
        },
      ].filter(Boolean),
    })
  } else {
    // @ts-ignore
    await api.updateSite({
      siteId,
      body: {
        build_settings: {
          env: newEnv,
        },
      },
    })
  }

  log(`Finished updating Graph-related environment variables for site ${siteInfo.name}`)
}

/**
 * Creates the `netlify graph:init` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphInitCommand = (program) =>
  program
    .command('graph:init')
    .description('Initialize all the resources for Netlify Graph')
    .action(async (options, command) => {
      await graphInit(options, command)
    })
