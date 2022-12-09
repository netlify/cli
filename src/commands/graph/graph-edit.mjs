// @ts-check
import gitRepoInfo from 'git-repo-info'

import { OneGraphCliClient, ensureCLISession, upsertMergeCLISessionMetadata } from '../../lib/one-graph/cli-client.mjs'
import {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteId,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} from '../../lib/one-graph/cli-netlify-graph.mjs'
import { NETLIFYDEVERR, chalk, error, log } from '../../utils/command-helpers.mjs'
import openBrowser from '../../utils/open-browser.mjs'

const { ensureAppForSite, executeCreatePersistedQueryMutation } = OneGraphCliClient

/**
 * Creates the `netlify graph:edit` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns
 */
const graphEdit = async (options, command) => {
  const { config, site, state } = command.netlify
  const siteId = site.id

  if (!site.id) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

  if (graphqlDocument.trim().length === 0) {
    graphqlDocument = defaultExampleOperationsDoc
  }

  const netlifyToken = await command.authenticate()
  const { jwt } = await OneGraphCliClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

  await ensureAppForSite(netlifyToken, siteId)

  const oneGraphSessionId = await ensureCLISession({
    config,
    metadata: {},
    netlifyToken,
    site,
    state,
    netlifyGraphConfig,
  })

  const { branch } = gitRepoInfo()
  const persistedResult = await executeCreatePersistedQueryMutation(
    {
      nfToken: netlifyToken,
      appId: siteId,
      description: 'Temporary snapshot of local queries',
      query: graphqlDocument,
      tags: ['netlify-cli', `session:${oneGraphSessionId}`, `git-branch:${branch}`],
    },
    {
      accessToken: jwt,
      siteId,
    },
  )

  const persistedDoc =
    persistedResult.data &&
    persistedResult.data.oneGraph &&
    persistedResult.data.oneGraph.createPersistedQuery &&
    persistedResult.data.oneGraph.createPersistedQuery.persistedQuery

  const newMetadata = { docId: persistedDoc.id }

  await upsertMergeCLISessionMetadata({
    config,
    jwt,
    siteId,
    siteRoot: site.root,
    oneGraphSessionId,
    newMetadata,
  })

  const graphEditUrl = getGraphEditUrlBySiteId({ siteId, oneGraphSessionId })

  log(`Opening graph:edit session at ${chalk.cyan(graphEditUrl)}`)
  await openBrowser({ url: graphEditUrl })
}

/**
 * Creates the `netlify graph:edit` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphEditCommand = (program) =>
  program
    .command('graph:edit')
    .description('Launch the browser to edit your local graph functions from Netlify')
    .action(async (options, command) => {
      await graphEdit(options, command)
    })
