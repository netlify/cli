import gitRepoInfo from 'git-repo-info'

import { OneGraphCliClient, generateSessionName, loadCLISession } from '../../lib/one-graph/cli-client.js'
import {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteName,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} from '../../lib/one-graph/cli-netlify-graph.js'
import { NETLIFYDEVERR, chalk, error, openBrowser } from '../../utils/index.js'

const { createCLISession, createPersistedQuery, ensureAppForSite, updateCLISessionMetadata } = OneGraphCliClient

/**
 * Creates the `netlify graph:edit` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const graphEdit = async (options, command) => {
  const { api, site, siteInfo, state } = command.netlify
  const siteId = site.id

  if (!site.id) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  const { branch } = gitRepoInfo()

  let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

  if (graphqlDocument.trim().length === 0) {
    graphqlDocument = defaultExampleOperationsDoc
  }

  const netlifyToken = await command.authenticate()

  await ensureAppForSite(netlifyToken, siteId)

  let oneGraphSessionId = loadCLISession(state)
  if (!oneGraphSessionId) {
    const sessionName = generateSessionName()
    const oneGraphSession = await createCLISession(netlifyToken, site.id, sessionName)
    state.set('oneGraphSessionId', oneGraphSession.id)
    oneGraphSessionId = state.get('oneGraphSessionId')
  }

  const persistedDoc = await createPersistedQuery(netlifyToken, {
    appId: siteId,
    description: 'Temporary snapshot of local queries',
    document: graphqlDocument,
    tags: ['netlify-cli', `session:${oneGraphSessionId}`, `git-branch:${branch}`],
  })

  await updateCLISessionMetadata(netlifyToken, siteId, oneGraphSessionId, { docId: persistedDoc.id })

  let siteName = siteInfo.name

  if (!siteName) {
    const siteData = await api.getSite({ siteId })
    siteName = siteData.name
    if (!siteName) {
      error(`No site name found for siteId ${siteId}`)
    }
  }

  const graphEditUrl = getGraphEditUrlBySiteName({ siteName, oneGraphSessionId })

  await openBrowser({ url: graphEditUrl })
}

/**
 * Creates the `netlify graph:edit` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
export const createGraphEditCommand = (program) =>
  program
    .command('graph:edit')
    .description('Launch the browser to edit your local graph functions from Netlify')
    .action(async (options, command) => {
      await graphEdit(options, command)
    })
