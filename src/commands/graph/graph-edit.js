const process = require('process')

const gitRepoInfo = require('git-repo-info')

const { createCLISession, createPersistedQuery, ensureAppForSite, loadCLISession } = require('../../lib/oneGraph/client')
const { readGraphQLOperationsSourceFile } = require('../../lib/oneGraph/netligraph')
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

    console.time("graph:edit")

    const siteData = await api.getSite({ siteId })

    const { branch } = gitRepoInfo()
    const cwd = process.cwd()
    const base = cwd;
    let graphqlDocument = readGraphQLOperationsSourceFile(`${base}/netlify`)

    if (graphqlDocument.trim().length === 0) {
        graphqlDocument = `query ExampleQuery {
  __typename
}`
    }

    const netlifyToken = await command.authenticate()

    await ensureAppForSite(netlifyToken, siteId)

    let oneGraphSessionId = loadCLISession(state)
    if (!oneGraphSessionId) {
        const oneGraphSession = await createCLISession(netlifyToken, site.id, "testing")
        state.set('oneGraphSessionId', oneGraphSession.id)
        oneGraphSessionId = state.get('oneGraphSessionId')
    }

    const persistedDoc = await createPersistedQuery(netlifyToken, {
        appId: siteId,
        description: "Temporary snapshot of local queries",
        document: graphqlDocument,
        tags: ["netlify-cli", `session:${oneGraphSessionId}`, `git-branch:${branch}`],
    })

    const url = `http://localhost:8080/sites/${siteData.name}/graph/explorer?sessionId=${oneGraphSessionId}&docId=${persistedDoc.id}`
    await openBrowser({ url })
    console.timeEnd("graph:edit")
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
