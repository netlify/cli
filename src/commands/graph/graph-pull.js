/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const { buildSchema } = require('graphql')

const {
  ackCLISessionEvents,
  fetchCliSessionEvents,
  handleCliSessionEvent,
  loadCLISession,
  refetchAndGenerateFromOneGraph,
} = require('../../lib/one-graph/client')
const { getNetligraphConfig, readGraphQLSchemaFile } = require('../../lib/one-graph/netlify-graph')
const { chalk, error, warn } = require('../../utils')

/**
 * Creates the `netlify graph:pull` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const graphPull = async (options, command) => {
  const { site, state } = command.netlify

  if (!site.id) {
    error(
      `No siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
    return
  }

  const netligraphConfig = await getNetligraphConfig({ command, options })
  const netlifyToken = await command.authenticate()
  const siteId = site.id
  await refetchAndGenerateFromOneGraph({ netligraphConfig, netlifyToken, state, siteId })

  const oneGraphSessionId = loadCLISession(state)

  if (!oneGraphSessionId) {
    warn('No local Netlify Graph session found, skipping command queue drain')
    return
  }

  const schemaString = readGraphQLSchemaFile(netligraphConfig)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (buildSchemaError) {
    error(`Error parsing schema: ${buildSchemaError.message}`)
    return
  }

  if (!schema) {
    error(`Failed to fetch and update Netlify GraphQL schema`)
    return
  }

  const next = await fetchCliSessionEvents({ appId: siteId, authToken: netlifyToken, sessionId: oneGraphSessionId })

  if (next.errors) {
    error(`Failed to fetch Netlify Graph cli session events`, next.errors)
    return
  }

  if (next.events) {
    const ackIds = []
    for (const event of next.events) {
      await handleCliSessionEvent({ authToken: netlifyToken, event, netligraphConfig, schema, siteId: site.id })
      ackIds.push(event.id)
    }

    await ackCLISessionEvents({
      appId: siteId,
      authToken: netlifyToken,
      sessionId: oneGraphSessionId,
      eventIds: ackIds,
    })
  }
}

/**
 * Creates the `netlify graph:pull` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphPullCommand = (program) =>
  program
    .command('graph:pull')
    .description('Pull down your local Netlify Graph schema, and process Graph edit events')
    .action(async (options, command) => {
      await graphPull(options, command)
    })

module.exports = { createGraphPullCommand }
