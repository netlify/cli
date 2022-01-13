/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const os = require('os')

const { buildClientSchema, parse } = require('graphql')
const fetch = require('node-fetch')

const { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, error, log, warn } = require('../../utils')

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
    error(`Netlify OneGraph return invalid HTTP status code: ${resp.status}`)
    return respBody
  }

  return respBody
}

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
    postError('Error fetching schema:', postError)
  }
}

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
      warn(`${NETLIFYDEVWARN} fetchOneGraph errors`, operationName, JSON.stringify(value, null, 2))
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

const fetchCliSessionEvents = async ({ appId, authToken, sessionId }) => {
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

const monitorCLISessionEvents = ({
  appId,
  authToken,
  netligraphConfig,
  onClose,
  onError,
  onEvents,
  sessionId,
  state,
}) => {
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
        `${NETLIFYDEVLOG} ${chalk.magenta(
          'Reloading',
        )} Netlify Graph schema..., ${enabledServicesCompareKey} => ${newEnabledServicesCompareKey}`,
      )
      await refetchAndGenerateFromOneGraph({ netligraphConfig, state, netlifyToken, siteId })
      log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} Netlify Graph schema and regenerated functions`)
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

const ackCLISessionEvents = async ({ appId, authToken, eventIds, sessionId }) => {
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

const refetchAndGenerateFromOneGraph = async ({ netlifyToken, netligraphConfig, siteId, state }) => {
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

const updateGraphQLOperationsFile = async ({ authToken, docId, netligraphConfig, schema, siteId }) => {
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
      warn(
        `${NETLIFYDEVWARN} Unrecognized event received, you may need to upgrade your CLI version`,
        __typename,
        payload,
      )
      break
    }
  }
}

const loadCLISession = (state) => state.get('oneGraphSessionId')

const startOneGraphCLISession = async ({ netlifyToken, netligraphConfig, site, state }) => {
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
        log(`${NETLIFYDEVLOG} ${chalk.magenta('Handling')} Netlify Graph event: ${eventName}...`)
        await handleCliSessionEvent({ authToken: netlifyToken, event, netligraphConfig, schema, siteId: site.id })
        log(`${NETLIFYDEVLOG} ${chalk.green('Finished handling')} Netlify Graph event: ${eventName}...`)
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

const ensureAppForSite = async (authToken, siteId) => {
  const app = await upsertAppForSite(authToken, siteId)
  const schema = await fetchAppSchema(authToken, app.id)
  if (!schema) {
    log(`${NETLIFYDEVLOG} Creating new empty default GraphQL schema for site....`)
    await createNewAppSchema(authToken, {
      appId: siteId,
      enabledServices: ['ONEGRAPH'],
      setAsDefaultForApp: true,
    })
  }
}

const fetchEnabledServices = async (authToken, appId) => {
  const appSchema = await fetchAppSchema(authToken, appId)
  return appSchema && appSchema.services
}

const generateSessionName = () => {
  const userInfo = os.userInfo('utf-8')
  const sessionName = `${userInfo.username}-${Date.now()}`
  log(`${NETLIFYDEVLOG} Generated Netlify Graph session name: ${sessionName}`)
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
