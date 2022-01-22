/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const os = require('os')

const { GraphQL, InternalConsole, OneGraphClient } = require('netlify-onegraph-internal')
const { NetlifyGraph } = require('netlify-onegraph-internal')

const { chalk, error, log, warn } = require('../../utils')

const { createCLISession, createPersistedQuery, ensureAppForSite, updateCLISessionMetadata } = OneGraphClient

const {
  generateFunctionsFile,
  generateHandler,
  readGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
} = require('./cli-netlify-graph')

const { parse } = GraphQL
const { defaultExampleOperationsDoc, extractFunctionsFromOperationDoc } = NetlifyGraph

const internalConsole = {
  log,
  warn,
  error,
  debug: console.debug,
}

InternalConsole.registerConsole(internalConsole)

/**
 * Start polling for CLI events for a given session to process locally
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {function} input.onClose A function to call when the polling loop is closed
 * @param {function} input.onError A function to call when an error occurs
 * @param {function} input.onEvents A function to call when CLI events are received and need to be processed
 * @param {string} input.sessionId The session id to monitor CLI events for
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @returns
 */
const monitorCLISessionEvents = (input) => {
  const { appId, netlifyGraphConfig, netlifyToken, onClose, onError, onEvents, sessionId, state } = input

  const frequency = 5000
  let shouldClose = false

  const enabledServiceWatcher = async (innerNetlifyToken, siteId) => {
    const enabledServices = state.get('oneGraphEnabledServices') || ['onegraph']
    const enabledServicesInfo = await OneGraphClient.fetchEnabledServices(innerNetlifyToken, siteId)
    if (!enabledServicesInfo) {
      warn('Unable to fetch enabled services for site for code generation')
      return
    }
    const newEnabledServices = enabledServicesInfo.map((service) => service.service)
    const enabledServicesCompareKey = enabledServices.sort().join(',')
    const newEnabledServicesCompareKey = newEnabledServices.sort().join(',')

    if (enabledServicesCompareKey !== newEnabledServicesCompareKey) {
      log(
        `${chalk.magenta(
          'Reloading',
        )} Netlify Graph schema..., ${enabledServicesCompareKey} => ${newEnabledServicesCompareKey}`,
      )
      await refetchAndGenerateFromOneGraph({ netlifyGraphConfig, state, netlifyToken: innerNetlifyToken, siteId })
      log(`${chalk.green('Reloaded')} Netlify Graph schema and regenerated functions`)
    }
  }

  const close = () => {
    shouldClose = true
  }

  let handle

  const helper = async () => {
    if (shouldClose) {
      clearTimeout(handle)
      onClose()
    }

    const next = await OneGraphClient.fetchCliSessionEvents({ appId, authToken: netlifyToken, sessionId })

    if (next.errors) {
      next.errors.forEach((fetchEventError) => {
        onError(fetchEventError)
      })
    }

    const { events } = next

    if (events.length !== 0) {
      const ackIds = await onEvents(events)
      await OneGraphClient.ackCLISessionEvents({ appId, authToken: netlifyToken, sessionId, eventIds: ackIds })
    }

    await enabledServiceWatcher(netlifyToken, appId)

    handle = setTimeout(helper, frequency)
  }

  // Fire immediately to start rather than waiting the initial `frequency`
  helper()

  return close
}

/**
 * Fetch the schema for a site, and regenerate all of the downstream files
 * @param {object} input
 * @param {string} input.siteId The id of the site to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @returns {Promise<void>}
 */
const refetchAndGenerateFromOneGraph = async (input) => {
  const { netlifyGraphConfig, netlifyToken, siteId, state } = input
  await OneGraphClient.ensureAppForSite(netlifyToken, siteId)

  const enabledServicesInfo = await OneGraphClient.fetchEnabledServices(netlifyToken, siteId)
  if (!enabledServicesInfo) {
    warn('Unable to fetch enabled services for site for code generation')
    return
  }

  const enabledServices = enabledServicesInfo
    .map((service) => service.service)
    .sort((aString, bString) => aString.localeCompare(bString))
  const schema = await OneGraphClient.fetchOneGraphSchema(siteId, enabledServices)

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const operations = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile(netlifyGraphConfig, schema, currentOperationsDoc, operations)
  writeGraphQLSchemaFile(netlifyGraphConfig, schema)
  state.set('oneGraphEnabledServices', enabledServices)
}

/**
 *
 * @param {object} input
 * @param {string} input.siteId The site id to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {string} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFile = async (input) => {
  const { docId, netlifyGraphConfig, netlifyToken, schema, siteId } = input
  const persistedDoc = await OneGraphClient.fetchPersistedQuery(netlifyToken, siteId, docId)
  if (!persistedDoc) {
    warn('No persisted doc found for:', docId)
    return
  }

  const doc = persistedDoc.query

  writeGraphQLOperationsSourceFile(netlifyGraphConfig, doc)
  const appOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  const parsedDoc = parse(appOperationsDoc, {
    noLocation: true,
  })
  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  generateFunctionsFile(netlifyGraphConfig, schema, appOperationsDoc, operations)
}

const handleCliSessionEvent = async ({ event, netlifyGraphConfig, netlifyToken, schema, siteId }) => {
  const { __typename, payload } = await event
  switch (__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent':
      await handleCliSessionEvent({ netlifyToken, event: payload, netlifyGraphConfig, schema, siteId })
      break
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
      await generateHandler(netlifyGraphConfig, schema, payload.operationId, payload)
      break
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
      await updateGraphQLOperationsFile({ netlifyToken, docId: payload.docId, netlifyGraphConfig, schema, siteId })
      break
    default: {
      warn(`Unrecognized event received, you may need to upgrade your CLI version`, __typename, payload)
      break
    }
  }
}

/**
 * Load the CLI session id from the local state
 * @param {state} state
 * @returns
 */
const loadCLISession = (state) => state.get('oneGraphSessionId')

/**
 * Idemponentially save the CLI session id to the local state and start monitoring for CLI events and upstream schema changes
 * @param {object} input
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @param {site} input.site The site object
 */
const startOneGraphCLISession = async (input) => {
  const { netlifyGraphConfig, netlifyToken, site, state } = input
  OneGraphClient.ensureAppForSite(netlifyToken, site.id)
  let oneGraphSessionId = loadCLISession(state)
  if (!oneGraphSessionId) {
    const sessionName = generateSessionName()
    const sessionMetadata = {}
    const oneGraphSession = await OneGraphClient.createCLISession(netlifyToken, site.id, sessionName, sessionMetadata)
    state.set('oneGraphSessionId', oneGraphSession.id)
    oneGraphSessionId = state.get('oneGraphSessionId')
  }

  const enabledServices = []
  const schema = await OneGraphClient.fetchOneGraphSchema(site.id, enabledServices)

  monitorCLISessionEvents({
    appId: site.id,
    netlifyToken,
    netlifyGraphConfig,
    sessionId: oneGraphSessionId,
    state,
    onEvents: async (events) => {
      for (const event of events) {
        const eventName = OneGraphClient.friendlyEventName(event)
        log(`${chalk.magenta('Handling')} Netlify Graph: ${eventName}...`)
        await handleCliSessionEvent({ netlifyToken, event, netlifyGraphConfig, schema, siteId: site.id })
        log(`${chalk.green('Finished handling')} Netlify Graph: ${eventName}...`)
      }
      return events.map((event) => event.id)
    },
    onError: (fetchEventError) => {
      error(`Netlify Graph upstream error: ${fetchEventError}`)
    },
    onClose: () => {
      log('Netlify Graph upstream closed')
    },
  })
}

/**
 * Generate a session name that can be identified as belonging to the current checkout
 * @returns {string} The name of the session to create
 */
const generateSessionName = () => {
  const userInfo = os.userInfo({ encoding: 'utf-8' })
  const sessionName = `${userInfo.username}-${Date.now()}`
  log(`Generated Netlify Graph session name: ${sessionName}`)
  return sessionName
}

const OneGraphCliClient = {
  ackCLISessionEvents: OneGraphClient.ackCLISessionEvents,
  createCLISession,
  createPersistedQuery,
  fetchCliSessionEvents: OneGraphClient.fetchCliSessionEvents,
  ensureAppForSite,
  updateCLISessionMetadata,
}

module.exports = {
  OneGraphCliClient,
  handleCliSessionEvent,
  generateSessionName,
  loadCLISession,
  monitorCLISessionEvents,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
}
