/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const os = require('os')

const { buildClientSchema, parse } = require('graphql')
const fetch = require('node-fetch')

const { chalk, error, log, warn } = require('../../utils')

const {
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  generateHandler,
  readGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
} = require('./netlify-graph')
const { internalOperationsDoc } = require('./one-graph-client-graphql-operations')

const ONEDASH_APP_ID = '0b066ba6-ed39-4db8-a497-ba0be34d5b2a'

const httpOkLow = 200
const httpOkHigh = 299
const basicPostTimeoutMilliseconds = 30_000

/**
 * The basic http function used to communicate with OneGraph.
 * The least opinionated function that can be used to communicate with OneGraph.
 * @param {string} url
 * @param {object} options
 * @returns {Promise<object>} The response from OneGraph
 */
const basicPost = async (url, options) => {
  const reqBody = options.body || ''
  const userHeaders = options.headers || {}

  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
    'Content-Length': reqBody.length,
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    timeout: basicPostTimeoutMilliseconds,
    compress: true,
    body: reqBody,
  })

  const respBody = await resp.text()

  if (resp.status < httpOkLow || resp.status > httpOkHigh) {
    warn('Response:', respBody)
    error(`Netlify Graph upstream return invalid HTTP status code: ${resp.status}`)
    return respBody
  }

  return respBody
}

/**
 * Given an appId and desired services, fetch the schema (in json form) for that app
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<object>} The schema for the app
 */
const fetchOneGraphSchemaJson = async (appId, enabledServices) => {
  const url = `https://serve.onegraph.com/schema?app_id=${appId}&services=${enabledServices.join(',')}`
  const headers = {}

  try {
    const response = await basicPost(url, {
      method: 'GET',
      headers,
      body: null,
    })

    return JSON.parse(response)
  } catch (postError) {
    error('Error fetching schema:', postError)
  }
}

/**
 * Given an appId and desired services, fetch the schema json for an app and parse it into a GraphQL Schema
 * @param {string} appId
 * @param {string[]} enabledServices
 * @returns {Promise<GraphQLSchema>} The schema for the app
 */
const fetchOneGraphSchema = async (appId, enabledServices) => {
  const result = await fetchOneGraphSchemaJson(appId, enabledServices)
  const schema = buildClientSchema(result.data)
  return schema
}

/**
 * Fetch data from OneGraph
 * @param {object} config
 * @param {string|null} config.accessToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} config.appId The app to query against, typically the siteId
 * @param {string} config.query The full GraphQL operation doc
 * @param {string} config.operationName The operation to execute inside of the GraphQL operation doc
 * @param {object} config.variables The variables to pass to the GraphQL operation
 * @returns {Promise<object>} The response from OneGraph
 */
const fetchOneGraph = async (config) => {
  const { accessToken, appId, operationName, query, variables } = config

  const payload = {
    query,
    variables,
    operationName,
  }

  const body = JSON.stringify(payload)
  try {
    const result = await basicPost(`https://serve.onegraph.com/graphql?app_id=${appId}&show_metrics=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body,
    })

    // @ts-ignore
    const value = JSON.parse(result)
    if (value.errors) {
      warn(`Errors seen fetching Netlify Graph upstream`, operationName, JSON.stringify(value, null, 2))
    }
    return value
  } catch {
    return {}
  }
}

/**
 * Fetch data from OneGraph using a previously persisted query
 * @param {object} config
 * @param {string|null} config.accessToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} config.appId The app to query against, typically the siteId
 * @param {string} config.docId The id of the previously persisted GraphQL operation doc
 * @param {string} config.operationName The operation to execute inside of the GraphQL operation doc
 * @param {object} config.variables The variables to pass to the GraphQL operation
 * @returns {Promise<object>} The response from OneGraph
 */
const fetchOneGraphPersisted = async (config) => {
  const { accessToken, appId, docId, operationName, variables } = config

  const payload = {
    doc_id: docId,
    variables,
    operationName,
  }
  try {
    const result = await basicPost(`https://serve.onegraph.com/graphql?app_id=${appId}`, {
      method: 'POST',
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: JSON.stringify(payload),
    })

    return JSON.parse(result)
  } catch {
    return {}
  }
}

/**
 * Fetch a persisted doc belonging to appId by its id
 * @param {string} authToken
 * @param {string} appId
 * @param {string} docId
 * @returns {string|undefined} The persisted operations doc
 */
const fetchPersistedQuery = async (authToken, appId, docId) => {
  const response = await fetchOneGraph({
    accessToken: authToken,
    appId: ONEDASH_APP_ID,
    query: internalOperationsDoc,
    operationName: 'PersistedQueryQuery',
    variables: {
      nfToken: authToken,
      appId,
      id: docId,
    },
  })

  const persistedQuery = response.data && response.data.oneGraph && response.data.oneGraph.persistedQuery

  return persistedQuery
}

/**
 *
 * @param {object} options
 * @param {string} options.appId The app to query against, typically the siteId
 * @param {string} options.authToken The (typically netlify) access token that is used for authentication
 * @param {string} options.sessionId The session id to fetch CLI events for
 * @returns {Promise<OneGraphCliEvents[]|undefined>} The unhandled events for the cli session to process
 */
const fetchCliSessionEvents = async (options) => {
  const { appId, authToken, sessionId } = options

  // Grab the first 1000 events so we can chew through as many at a time as possible
  const desiredEventCount = 1000
  const next = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: 'CLISessionEventsQuery',
    variables: {
      nfToken: authToken,
      sessionId,
      first: desiredEventCount,
    },
  })

  if (next.errors) {
    return next
  }

  const events = (next.data && next.data.oneGraph && next.data.oneGraph.netlifyCliEvents) || []

  return { events }
}
/**
 * Start polling for CLI events for a given session to process locally
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.authToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlgraphConfig} input.netligraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {function} input.onClose A function to call when the polling loop is closed
 * @param {function} input.onError A function to call when an error occurs
 * @param {function} input.onEvents A function to call when CLI events are received and need to be processed
 * @param {string} input.sessionId The session id to monitor CLI events for
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @returns
 */
const monitorCLISessionEvents = (input) => {
  const { appId, authToken, netligraphConfig, onClose, onError, onEvents, sessionId, state } = input

  const frequency = 5000
  let shouldClose = false

  const enabledServiceWatcher = async (netlifyToken, siteId) => {
    const enabledServices = state.get('oneGraphEnabledServices') || ['onegraph']
    const enabledServicesInfo = await fetchEnabledServices(netlifyToken, siteId)
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
      await refetchAndGenerateFromOneGraph({ netligraphConfig, state, netlifyToken, siteId })
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

    const next = await fetchCliSessionEvents({ appId, authToken, sessionId })

    if (next.errors) {
      next.errors.forEach((fetchEventError) => {
        onError(fetchEventError)
      })
    }

    const { events } = next

    if (events.length !== 0) {
      const ackIds = await onEvents(events)
      await ackCLISessionEvents({ appId, authToken, sessionId, eventIds: ackIds })
    }

    await enabledServiceWatcher(authToken, appId)

    handle = setTimeout(helper, frequency)
  }

  // Fire immediately to start rather than waiting the initial `frequency`
  helper()

  return close
}

/**
 * Register a new CLI session with OneGraph
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} name The name of the CLI session, will be visible in the UI and CLI ouputs
 * @param {object} metadata Any additional metadata to attach to the session
 * @returns {Promise<object|undefined>} The CLI session object
 */
const createCLISession = async (netlifyToken, appId, name, metadata) => {
  const payload = {
    nfToken: netlifyToken,
    appId,
    name,
    metadata,
  }

  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: 'CreateCLISessionMutation',
    variables: payload,
  })

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createNetlifyCliSession &&
    result.data.oneGraph.createNetlifyCliSession.session

  return session
}

/**
 * Update the CLI session with new metadata (e.g. the latest docId) by its id
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {string} appId The app to query against, typically the siteId
 * @param {string} sessionId The session id to update
 * @param {object} metadata The new metadata to set on the session
 * @returns {Promise<object|undefined>} The updated session object
 */
const updateCLISessionMetadata = async (netlifyToken, appId, sessionId, metadata) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: 'UpdateCLISessionMetadataMutation',
    variables: {
      nfToken: netlifyToken,
      sessionId,
      metadata,
    },
  })

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.updateNetlifyCliSession &&
    result.data.oneGraph.updateNetlifyCliSession.session

  return session
}

/**
 * Acknoledge CLI events that have been processed and delete them from the upstream queue
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.sessionId The session id the events belong to
 * @param {string[]} input.eventIds The event ids to ack (and delete) from the session queue, having been processed
 * @returns
 */
const ackCLISessionEvents = async (input) => {
  const { appId, authToken, eventIds, sessionId } = input
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: 'AckCLISessionEventMutation',
    variables: {
      nfToken: authToken,
      sessionId,
      eventIds,
    },
  })

  const events = result.data && result.data.oneGraph && result.data.oneGraph.ackNetlifyCliEvents

  return events
}

/**
 * Create a persisted operations doc to be later retrieved, usually from a GUI
 * @param {string} netlifyToken The netlify token to use for authentication
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.document The GraphQL operations document to persist
 * @param {string} input.description A description of the operations doc
 * @param {string[]} input.tags A list of tags to attach to the operations doc
 * @returns
 */
const createPersistedQuery = async (netlifyToken, { appId, description, document, tags }) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId,
    query: internalOperationsDoc,
    operationName: 'CreatePersistedQueryMutation',
    variables: {
      nfToken: netlifyToken,
      appId,
      query: document,
      tags,
      description,
    },
  })

  const persistedQuery =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createPersistedQuery &&
    result.data.oneGraph.createPersistedQuery.persistedQuery

  return persistedQuery
}

/**
 * Fetch the schema for a site, and regenerate all of the downstream files
 * @param {object} input
 * @param {string} input.siteId The id of the site to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlgraphConfig} input.netligraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @returns {Promise<undefined>}
 */
const refetchAndGenerateFromOneGraph = async (input) => {
  const { netlifyToken, netligraphConfig, siteId, state } = input
  await ensureAppForSite(netlifyToken, siteId)

  const enabledServicesInfo = await fetchEnabledServices(netlifyToken, siteId)
  if (!enabledServicesInfo) {
    warn('Unable to fetch enabled services for site for code generation')
    return
  }

  const enabledServices = enabledServicesInfo
    .map((service) => service.service)
    .sort((aString, bString) => aString.localeCompare(bString))
  const schema = await fetchOneGraphSchema(siteId, enabledServices)
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netligraphConfig)

  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const operations = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile(netligraphConfig, schema, currentOperationsDoc, operations)
  writeGraphQLSchemaFile(netligraphConfig, schema)
  state.set('oneGraphEnabledServices', enabledServices)
}

/**
 *
 * @param {object} input
 * @param {string} input.siteId The site id to query against
 * @param {string} input.authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {string} input.schema The GraphQL schema to use when generating code
 * @param {NetlgraphConfig} input.netligraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFile = async (input) => {
  const { authToken, docId, netligraphConfig, schema, siteId } = input
  const persistedDoc = await fetchPersistedQuery(authToken, siteId, docId)
  if (!persistedDoc) {
    warn('No persisted doc found for:', docId)
    return
  }

  const doc = persistedDoc.query

  writeGraphQLOperationsSourceFile(netligraphConfig, doc)
  const appOperationsDoc = readGraphQLOperationsSourceFile(netligraphConfig)
  const parsedDoc = parse(appOperationsDoc, {
    noLocation: true,
  })
  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  generateFunctionsFile(netligraphConfig, schema, appOperationsDoc, operations)
}

const friendlyEventName = (event) => {
  const { __typename, payload } = event
  switch (__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent':
      return friendlyEventName(payload)
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
      return 'Generate handler as Netlify function '
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
      return `Sync Netlify Graph operations library`
    default: {
      return `Unrecognized event (${__typename})`
    }
  }
}

const handleCliSessionEvent = async ({ authToken, event, netligraphConfig, schema, siteId }) => {
  const { __typename, payload } = await event
  switch (__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent':
      await handleCliSessionEvent({ authToken, event: payload, netligraphConfig, schema, siteId })
      break
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
      await generateHandler(netligraphConfig, schema, payload.operationId, payload)
      break
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
      await updateGraphQLOperationsFile({ authToken, docId: payload.docId, netligraphConfig, schema, siteId })
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
 * @param {NetlgraphConfig} input.netligraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {state} input.state A function to call to set/get the current state of the local Netlify project
 * @param {site} input.site The site object
 */
const startOneGraphCLISession = async (input) => {
  const { netlifyToken, netligraphConfig, site, state } = input
  let oneGraphSessionId = loadCLISession(state)
  if (!oneGraphSessionId) {
    const sessionName = generateSessionName()
    const oneGraphSession = await createCLISession(netlifyToken, site.id, sessionName)
    state.set('oneGraphSessionId', oneGraphSession.id)
    oneGraphSessionId = state.get('oneGraphSessionId')
  }

  const enabledServices = []
  const schema = await fetchOneGraphSchema(site.id, enabledServices)

  monitorCLISessionEvents({
    appId: site.id,
    authToken: netlifyToken,
    netligraphConfig,
    sessionId: oneGraphSessionId,
    state,
    onEvents: async (events) => {
      for (const event of events) {
        const eventName = friendlyEventName(event)
        log(`${chalk.magenta('Handling')} Netlify Graph event: ${eventName}...`)
        await handleCliSessionEvent({ authToken: netlifyToken, event, netligraphConfig, schema, siteId: site.id })
        log(`${chalk.green('Finished handling')} Netlify Graph event: ${eventName}...`)
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
 * Fetch the schema metadata for a site (enabled services, id, etc.)
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to query against
 * @returns {Promise<object|undefined>} The schema metadata for the site
 */
const fetchAppSchema = async (authToken, siteId) => {
  const result = await fetchOneGraph({
    accessToken: authToken,
    appId: siteId,
    query: internalOperationsDoc,
    operationName: 'AppSchemaQuery',
    variables: {
      nfToken: authToken,
      appId: siteId,
    },
  })

  return result.data && result.data.oneGraph && result.data.oneGraph.app && result.data.oneGraph.app.graphQLSchema
}

/**
 * If a site does not exists upstream in OneGraph for the given site, create it
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
const upsertAppForSite = async (authToken, siteId) => {
  const result = await fetchOneGraph({
    accessToken: authToken,
    appId: ONEDASH_APP_ID,
    query: internalOperationsDoc,
    operationName: 'UpsertAppForSiteMutation',
    variables: {
      nfToken: authToken,
      siteId,
    },
  })

  return (
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.upsertAppForNetlifySite &&
    result.data.oneGraph.upsertAppForNetlifySite.app
  )
}

/**
 * Create a new schema in OneGraph for the given site with the specified metadata (enabled services, etc.)
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {object} input The details of the schema to create
 * @returns {Promise<object>} The schema metadata for the site
 */
const createNewAppSchema = async (nfToken, input) => {
  const result = await fetchOneGraph({
    accessToken: null,
    appId: input.appId,
    query: internalOperationsDoc,
    operationName: 'CreateNewSchemaMutation',
    variables: {
      nfToken,
      input,
    },
  })

  return (
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createGraphQLSchema &&
    result.data.oneGraph.createGraphQLSchema.graphqlSchema
  )
}

/**
 * Ensure that an app exists upstream in OneGraph for the given site
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} siteId The site id to create an app for upstream on OneGraph
 * @returns
 */
const ensureAppForSite = async (authToken, siteId) => {
  const app = await upsertAppForSite(authToken, siteId)
  const schema = await fetchAppSchema(authToken, app.id)
  if (!schema) {
    log(`Creating new empty default GraphQL schema for site....`)
    await createNewAppSchema(authToken, {
      appId: siteId,
      enabledServices: ['ONEGRAPH'],
      setAsDefaultForApp: true,
    })
  }
}

/**
 * Fetch a list of what services are enabled for the given site
 * @param {string} authToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} appId The app id to query against
 * @returns
 */
const fetchEnabledServices = async (authToken, appId) => {
  const appSchema = await fetchAppSchema(authToken, appId)
  return appSchema && appSchema.services
}

/**
 * Generate a session name that can be identified as belonging to the current checkout
 * @returns {string} The name of the session to create
 */
const generateSessionName = () => {
  const userInfo = os.userInfo('utf-8')
  const sessionName = `${userInfo.username}-${Date.now()}`
  log(`Generated Netlify Graph session name: ${sessionName}`)
  return sessionName
}

module.exports = {
  ackCLISessionEvents,
  createCLISession,
  createPersistedQuery,
  ensureAppForSite,
  fetchCliSessionEvents,
  fetchOneGraphPersisted,
  fetchOneGraphSchemaJson,
  fetchOneGraphSchema,
  fetchPersistedQuery,
  handleCliSessionEvent,
  generateSessionName,
  loadCLISession,
  monitorCLISessionEvents,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
  updateCLISessionMetadata,
  upsertAppForSite,
}
