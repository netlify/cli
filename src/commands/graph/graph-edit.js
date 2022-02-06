// @ts-check
const gitRepoInfo = require('git-repo-info')

const { OneGraphCliClient, generateSessionName, loadCLISession } = require('../../lib/one-graph/cli-client')
const {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteId,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { NETLIFYDEVERR, chalk, error } = require('../../utils')
const { openBrowser } = require('../../utils/open-browser')

const { createCLISession, createPersistedQuery, ensureAppForSite, updateCLISessionMetadata } = OneGraphCliClient

/**
 * Creates the `netlify graph:edit` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphEdit = async (options, command) => {
  const { site, state } = command.netlify
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
    const oneGraphSession = await createCLISession(netlifyToken, site.id, sessionName, null)
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

  const graphEditUrl = getGraphEditUrlBySiteId({ siteId, oneGraphSessionId })

  await openBrowser({ url: graphEditUrl })
}

/**
 * Creates the `netlify graph:edit` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphEditCommand = (program) =>
  program
    .command('graph:edit')
    .description('Launch the browser to edit your local graph functions from Netlify')
    .action(async (options, command) => {
      await graphEdit(options, command)
    })

module.exports = { createGraphEditCommand }
