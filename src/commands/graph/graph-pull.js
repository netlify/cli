const process = require('process')

const { buildSchema } = require('graphql')

const {
  ackCLISessionEvents,
  fetchCliSessionEvents,
  handleCliSessionEvent,
  loadCLISession,
  refetchAndGenerateFromOneGraph,
} = require('../../lib/one-graph/client')
const { getNetligraphConfig, readGraphQLSchemaFile } = require('../../lib/one-graph/netlify-graph')
const { NETLIFYDEVERR, chalk } = require('../../utils')

const graphPull = async (options, command) => {
  const { site, state } = command.netlify

  if (!site.id) {
    console.error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const netligraphConfig = getNetligraphConfig({ command, options })
  const netlifyToken = await command.authenticate()
  const siteId = site.id
  await refetchAndGenerateFromOneGraph({ netligraphConfig, netlifyToken, state, siteId })

  const oneGraphSessionId = loadCLISession(state)

  if (!oneGraphSessionId) {
    console.warn('No local Netlify Graph session found, skipping command queue drain')
    return
  }

  const schemaString = readGraphQLSchemaFile(netligraphConfig)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (error) {
    console.error(`${NETLIFYDEVERR} Error parsing schema: ${error.message}`)
    process.exit(1)
  }

  if (!schema) {
    console.error(`${NETLIFYDEVERR} Failed to fetch and update Netlify GraphQL schem`)
    process.exit(1)
  }

  const next = await fetchCliSessionEvents({ appId: siteId, authToken: netlifyToken, sessionId: oneGraphSessionId })

  if (next.errors) {
    console.error(`${NETLIFYDEVERR} Failed to fetch Netlify Graph cli session events`, next.errors)
    process.exit(1)
  }

  if (next.events) {
    const ackIds = []
    const handled = next.events.map(async (event) => {
      await handleCliSessionEvent({ authToken: netlifyToken, event, netligraphConfig, schema, siteId: site.id })
      ackIds.push(event.id)
    })

    await Promise.all(handled)

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
    .description('Pull down your local Netlify Graph schema and regenerate your local functions')
    .action(async (options, command) => {
      await graphPull(options, command)
    })

module.exports = { createGraphPullCommand }
