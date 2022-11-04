// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'OneGraphCl... Remove this comment to see the full error message
const { OneGraphClient } = require('netlify-onegraph-internal')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'uuidv4'.
const { v4: uuidv4 } = require('uuid')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'OneGraphCl... Remove this comment to see the full error message
const { OneGraphCliClient, ensureCLISession } = require('../../lib/one-graph/cli-client.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNetlify... Remove this comment to see the full error message
const { getNetlifyGraphConfig } = require('../../lib/one-graph/cli-netlify-graph.cjs')
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
  NETLIFYDEVERR,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
  chalk,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
  exit,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getToken'.
  getToken,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'translateF... Remove this comment to see the full error message
  translateFromEnvelopeToMongo,
} = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ensureAppF... Remove this comment to see the full error message
const { ensureAppForSite, executeCreateApiTokenMutation } = OneGraphCliClient

/**
 * Creates the `netlify graph:init` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const graphInit = async (options: $TSFixMe, command: $TSFixMe) => {
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

  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const createGraphInitCommand = (program: $TSFixMe) => program
  .command('graph:init')
  .description('Initialize all the resources for Netlify Graph')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await graphInit(options, command)
  })

module.exports = { createGraphInitCommand }
