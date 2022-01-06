const process = require('process')

const gitRepoInfo = require('git-repo-info')

const {
  createCLISession,
  createPersistedQuery,
  ensureAppForSite,
  generateSessionName,
  loadCLISession,
  updateCLISessionMetadata,
} = require('../../lib/oneGraph/client')
const { defaultExampleOperationsDoc, getNetligraphConfig, readGraphQLOperationsSourceFile } = require('../../lib/oneGraph/netligraph')
const { NETLIFYDEVERR, chalk } = require('../../utils')
const { openBrowser } = require('../../utils/open-browser')

const graphEdit = async (options, command) => {
  const { api, site, state } = command.netlify
  const siteId = site.id

  if (!site.id) {
    console.error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netligraph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  console.time('graph:edit')

  const siteData = await api.getSite({ siteId })

  const netligraphConfig = getNetligraphConfig({ command, options })

  const { branch } = gitRepoInfo()

  let graphqlDocument = readGraphQLOperationsSourceFile(netligraphConfig)

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

  const host = process.env.NETLIFY_APP_HOST || `localhost:8080`

  const url = `http://${host}/sites/${siteData.name}/graph/explorer?cliSessionId=${oneGraphSessionId}`
  await openBrowser({ url })
  console.timeEnd('graph:edit')
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
