// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
import { OneGraphClient } from 'netlify-onegraph-internal'

import {
  OneGraphCliClient,
  ensureCLISession,
  handleCliSessionEvent,
  loadCLISession,
  readLockfile,
  readSchemaIdFromLockfile,
  refetchAndGenerateFromOneGraph,
} from '../../lib/one-graph/cli-client.mjs'
import { buildSchema, getNetlifyGraphConfig, readGraphQLSchemaFile } from '../../lib/one-graph/cli-netlify-graph.mjs'
import { NETLIFYDEVERR, chalk, error, log, warn } from '../../utils/command-helpers.mjs'

/**
 * Creates the `netlify graph:pull` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns
 */
const graphPull = async (options, command) => {
  const { config, site, state } = command.netlify

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

  const { jwt } = await OneGraphCliClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

  let oneGraphSessionId = loadCLISession(state)
  let lockfile = readLockfile({ siteRoot: command.netlify.site.root })

  if (!oneGraphSessionId || !lockfile) {
    warn(
      'No local Netlify Graph session found, skipping command queue drain. Create a new session by running `netlify graph:edit`.',
    )
    oneGraphSessionId = await ensureCLISession({
      config,
      netlifyGraphConfig,
      metadata: {},
      netlifyToken,
      site,
      state,
    })

    lockfile = readLockfile({ siteRoot: command.netlify.site.root })
  }

  if (lockfile === undefined) {
    error(`${NETLIFYDEVERR} Error: unable to create lockfile for site and session, exiting.`)
    return
  }

  const { schemaId } = lockfile.locked

  await refetchAndGenerateFromOneGraph({
    config,
    logger: log,
    netlifyGraphConfig,
    jwt,
    schemaId,
    state,
    siteId,
    sessionId: oneGraphSessionId,
  })

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
    jwt,
    sessionId: oneGraphSessionId,
  })

  if (!next) {
    return
  }

  if (next.errors) {
    error(`Failed to fetch Netlify Graph cli session events: ${JSON.stringify(next.errors, null, 2)}`)
  }

  if (next.events) {
    const ackEventIds = []
    for (const event of next.events) {
      try {
        const audience = event.audience || OneGraphClient.eventAudience(event)

        if (audience === 'CLI') {
          const eventName = OneGraphClient.friendlyEventName(event)
          log(`${chalk.magenta('Handling')} Netlify Graph: ${eventName}...`)
          const nextSchemaId = readSchemaIdFromLockfile({ siteRoot: site.root })

          if (!nextSchemaId) {
            warn('Unable to load schemaId from Netlify Graph lockfile')
            return
          }

          if (!schema) {
            warn('Unable to load schema from for Netlify Graph')
            return
          }

          await handleCliSessionEvent({
            config,
            netlifyToken,
            // @ts-expect-error
            event,
            netlifyGraphConfig,
            schema,
            schemaId: nextSchemaId,
            sessionId: oneGraphSessionId,
            siteId: site.id,
            siteRoot: site.root,
          })
          ackEventIds.push(event.id)
        }
      } catch (error_) {
        warn(`Error processing individual Netlify Graph event, skipping:
${JSON.stringify(error_, null, 2)}`)
        ackEventIds.push(event.id)
      }
    }

    await OneGraphCliClient.ackCLISessionEvents({
      appId: siteId,
      jwt,
      sessionId: oneGraphSessionId,
      eventIds: ackEventIds,
    })
  }
}

/**
 * Creates the `netlify graph:pull` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphPullCommand = (program) =>
  program
    .command('graph:pull')
    .description('Pull your remote Netlify Graph schema locally, and process pending Graph edit events')
    .action(async (options, command) => {
      await graphPull(options, command)
    })
