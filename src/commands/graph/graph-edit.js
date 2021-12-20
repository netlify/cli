const process = require('process')

const gitRepoInfo = require('git-repo-info')

const { createCLISession, createPersistedQuery, loadCLISession } = require('../../lib/oneGraph/client')
const { readGraphQLOperationsSourceFile } = require('../../lib/oneGraph/netligraph')
const { warn } = require('../../utils/command-helpers')
const { openBrowser } = require('../../utils/open-browser')


const graphEdit = async (options, command) => {
    const { api, site, state } = command.netlify
    const siteId = site.id

    if (!siteId) {
        warn(`No Site ID found in current directory.
Run \`netlify link\` to connect to this folder to a site`)
        return false
    }

    const oneGraphAdminToken = command.netlify.cachedConfig.env.ONEGRAPH_ADMIN_JWT && command.netlify.cachedConfig.env.ONEGRAPH_ADMIN_JWT.value;

    if (!oneGraphAdminToken) {
        command.error('You must set ONEGRAPH_ADMIN_JWT in your Netlify environment variables to edit a schema from OneGraph')
    }

    console.time("graph:edit")

    const siteData = await api.getSite({ siteId })

    const { branch } = gitRepoInfo()
    const cwd = process.cwd()
    const base = cwd;
    const graphqlDocument = readGraphQLOperationsSourceFile(`${base}/netlify`)

    const netlifyToken = await command.authenticate()

    let oneGraphSessionId = loadCLISession(state)
    if (!oneGraphSessionId) {
        const oneGraphSession = await createCLISession(netlifyToken, site.id, "testing")
        state.set('oneGraphSessionId', oneGraphSession.id)
        oneGraphSessionId = state.get('oneGraphSessionId')
    }

    console.log(`Using OneGraph session ${oneGraphSessionId}`)

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
