// @ts-check
import events from 'events'
import process from 'process'

import {
  OneGraphCliClient,
  loadCLISession,
  markCliSessionInactive,
  persistNewOperationsDocForSession,
  startOneGraphCLISession,
} from '../lib/one-graph/cli-client.mjs'
import {
  defaultExampleOperationsDoc,
  getGraphEditUrlBySiteId,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} from '../lib/one-graph/cli-netlify-graph.mjs'

import { chalk, error, getToken, log, normalizeConfig, warn, watchDebounced } from './command-helpers.mjs'
import { generateNetlifyGraphJWT, processOnExit } from './dev.mjs'
import { addCleanupJob } from './shell.mjs'

export const startPollingForAPIAuthentication = async function (options) {
  const { api, command, config, site, siteInfo } = options
  const frequency = 5000

  const helper = async (maybeSiteData) => {
    const siteData = await (maybeSiteData || api.getSite({ siteId: site.id }))
    const authlifyTokenId = siteData && siteData.authlify_token_id

    const existingAuthlifyTokenId = config && config.netlifyGraphConfig && config.netlifyGraphConfig.authlifyTokenId
    if (authlifyTokenId && authlifyTokenId !== existingAuthlifyTokenId) {
      const netlifyToken = await command.authenticate()
      // Only inject the authlify config if a token ID exists. This prevents
      // calling command.authenticate() (which opens a browser window) if the
      // user hasn't enabled API Authentication
      const netlifyGraphConfig = {
        netlifyToken,
        authlifyTokenId: siteData.authlify_token_id,
        siteId: site.id,
      }
      config.netlifyGraphConfig = netlifyGraphConfig

      const netlifyGraphJWT = generateNetlifyGraphJWT(netlifyGraphConfig)

      if (netlifyGraphJWT != null) {
        // XXX(anmonteiro): this name is deprecated. Delete after 3/31/2022
        process.env.ONEGRAPH_AUTHLIFY_TOKEN = netlifyGraphJWT
        process.env.NETLIFY_GRAPH_TOKEN = netlifyGraphJWT
      }
    } else if (!authlifyTokenId) {
      // If there's no `authlifyTokenId`, it's because the user disabled API
      // Auth. Delete the config in this case.
      delete config.netlifyGraphConfig
    }

    setTimeout(helper, frequency)
  }

  await helper(siteInfo)
}

export const startNetlifyGraph = async ({
  command,
  config,
  options,
  settings,
  site,
  startNetlifyGraphWatcher,
  state,
}) => {
  if (startNetlifyGraphWatcher && options.offline) {
    warn(`Unable to start Netlify Graph in offline mode`)
  } else if (startNetlifyGraphWatcher && !site.id) {
    error(
      `No siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}.`,
    )
  } else if (startNetlifyGraphWatcher) {
    const netlifyToken = await command.authenticate()
    await OneGraphCliClient.ensureAppForSite(netlifyToken, site.id)

    let stopWatchingCLISessions

    let liveConfig = { ...config }
    let isRestartingSession = false

    const createOrResumeSession = async function () {
      const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options, settings })

      let graphqlDocument = readGraphQLOperationsSourceFile(netlifyGraphConfig)

      if (!graphqlDocument || graphqlDocument.trim().length === 0) {
        graphqlDocument = defaultExampleOperationsDoc
      }

      stopWatchingCLISessions = await startOneGraphCLISession({
        config: liveConfig,
        netlifyGraphConfig,
        netlifyToken,
        site,
        state,
        oneGraphSessionId: options.sessionId,
      })

      // Should be created by startOneGraphCLISession
      const oneGraphSessionId = loadCLISession(state)

      await persistNewOperationsDocForSession({
        config: liveConfig,
        netlifyGraphConfig,
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: graphqlDocument,
        siteId: site.id,
        siteRoot: site.root,
      })

      return oneGraphSessionId
    }

    const configWatcher = new events.EventEmitter()

    // Only set up a watcher if we know the config path.
    const { configPath } = command.netlify.site
    if (configPath) {
      // chokidar handle
      command.configWatcherHandle = await watchDebounced(configPath, {
        depth: 1,
        onChange: async () => {
          const cwd = options.cwd || process.cwd()
          const [token] = await getToken(options.auth)
          const { config: newConfig } = await command.getConfig({ cwd, state, token, ...command.netlify.apiUrlOpts })

          const normalizedNewConfig = normalizeConfig(newConfig)
          configWatcher.emit('change', normalizedNewConfig)
        },
      })

      processOnExit(async () => {
        await command.configWatcherHandle.close()
      })
    }

    // Set up a handler for config changes.
    configWatcher.on('change', async (newConfig) => {
      command.netlify.config = newConfig
      liveConfig = newConfig
      if (isRestartingSession) {
        return
      }
      stopWatchingCLISessions && stopWatchingCLISessions()
      isRestartingSession = true
      await createOrResumeSession()
      isRestartingSession = false
    })

    const oneGraphSessionId = await createOrResumeSession()
    const cleanupSession = () => markCliSessionInactive({ netlifyToken, sessionId: oneGraphSessionId, siteId: site.id })

    addCleanupJob(cleanupSession)

    const graphEditUrl = getGraphEditUrlBySiteId({ siteId: site.id, oneGraphSessionId })

    log(
      `Starting Netlify Graph session, to edit your library visit ${graphEditUrl} or run \`netlify graph:edit\` in another tab`,
    )
  }
}
