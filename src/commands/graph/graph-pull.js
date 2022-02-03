/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const {
  OneGraphCliClient,
  handleCliSessionEvent,
  loadCLISession,
  refetchAndGenerateFromOneGraph,
} = require('../../lib/one-graph/cli-client')
const { buildSchema, getNetlifyGraphConfig, readGraphQLSchemaFile } = require('../../lib/one-graph/cli-netlify-graph')
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
  }

  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  const netlifyToken = await command.authenticate()
  const siteId = site.id

  await refetchAndGenerateFromOneGraph({ netlifyGraphConfig, netlifyToken, state, siteId })

  const oneGraphSessionId = loadCLISession(state)

  if (!oneGraphSessionId) {
    warn('No local Netlify Graph session found, skipping command queue drain')
    return
  }

  const schemaString = readGraphQLSchemaFile(netlifyGraphConfig)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (buildSchemaError) {
    error(`Error parsing schema: ${buildSchemaError}`)
  }

  if (!schema) {
    error(`Failed to fetch and update Netlify GraphQL schema`)
  }

  const next = await OneGraphCliClient.fetchCliSessionEvents({
    appId: siteId,
    authToken: netlifyToken,
    sessionId: oneGraphSessionId,
  })

  if (next.errors) {
    error(`Failed to fetch Netlify Graph cli session events`, next.errors)
  }

  if (next.events) {
    const ackIds = []
    for (const event of next.events) {
      await handleCliSessionEvent({ netlifyToken, event, netlifyGraphConfig, schema, siteId: site.id })
      ackIds.push(event.id)
    }

    await OneGraphCliClient.ackCLISessionEvents({
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
    .description('Pull down your local Netlify Graph schema, and process pending Graph edit events')
    .action(async (options, command) => {
      await graphPull(options, command)
    })

module.exports = { createGraphPullCommand }
