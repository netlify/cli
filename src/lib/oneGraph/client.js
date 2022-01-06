const os = require('os')

const dotProp = require('dot-prop')
const { buildClientSchema, parse } = require('graphql')
const fetch = require('node-fetch')

const { NETLIFYDEVLOG, chalk, log } = require('../../utils')

const {
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  generateHandler,
  readGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile
} = require('./netligraph')

const ONEDASH_APP_ID = '0b066ba6-ed39-4db8-a497-ba0be34d5b2a'

const httpOkLow = 200
const httpOkHigh = 299

const basicPost = async (url, options) => {
  const reqBody = options.body || ''
  const userHeaders = options.headers || {}

  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
    'Content-Length': reqBody.length,
  }

  const timeoutMilliseconds = 30000

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    timeout: timeoutMilliseconds,
    compress: true,
    body: reqBody,
  })

  const respBody = await resp.text()

  if (resp.status < httpOkLow || resp.status > httpOkHigh) {
    console.warn('Response:', respBody)
    throw new Error(`Netlify OneGraph return non - OK HTTP status code: ${resp.status}`)
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
  } catch (error) {
    console.error('Error fetching schema:', error)
  }
}

const fetchOneGraphSchema = async (appId, enabledServices) => {
  const result = await fetchOneGraphSchemaJson(appId, enabledServices)
  const schema = buildClientSchema(result.data)
  return schema
}

const fetchOneGraph = async (
  accessToken,
  appId,
  query,
  operationName,
  variables,
  // eslint-disable-next-line max-params
) => {
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
        'Accept': 'application/json',
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body,
    })

    // @ts-ignore
    const value = JSON.parse(result)
    if (value.errors) {
      console.log('fetchOneGraph errors', JSON.stringify(value, null, 2))
    }
    return value
  } catch (error) {
    return {}
  }
}

const fetchOneGraphPersisted = async (
  appId,
  accessToken,
  docId,
  operationName,
  variables,
  // eslint-disable-next-line max-params
) => {
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
  } catch (error) {
    return {}
  }
}

const internalOperationsDoc = `mutation CreatePersistedQueryMutation(
  $nfToken: String!
  $appId: String!
  $query: String!
  $tags: [String!]!
  $description: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createPersistedQuery(
      input: {
        query: $query
        appId: $appId
        tags: $tags
        description: $description
      }
    ) {
      persistedQuery {
        id
      }
    }
  }
}

query ListPersistedQueries(
    $appId: String!
    $first: Int!
    $after: String
    $tags: [String!]!
  ) {
    oneGraph {
      app(id: $appId) {
        id
        persistedQueries(
          first: $first
          after: $after
          tags: $tags
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            query
            fixedVariables
            freeVariables
            allowedOperationNames
            tags
            description
          }
        }
      }
    }
  }
  
  subscription ListPersistedQueriesSubscription(
    $appId: String!
    $first: Int!
    $after: String
    $tags: [String!]!
  ) {
    poll(
      onlyTriggerWhenPayloadChanged: true
      schedule: { every: { minutes: 1 } }
    ) {
      query {
        oneGraph {
          app(id: $appId) {
            id
            persistedQueries(
              first: $first
              after: $after
              tags: $tags
            ) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                query
                fixedVariables
                freeVariables
                allowedOperationNames
                tags
                description
              }
            }
          }
        }
      }
    }
  }
  
  query PersistedQueriesQuery(
    $nfToken: String!
    $appId: String!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      app(id: $appId) {
        persistedQueries {
          nodes {
            id
            query
            allowedOperationNames
            description
            freeVariables
            fixedVariables
            tags
          }
        }
      }
    }
  }
  
  query PersistedQueryQuery(
    $nfToken: String!
    $appId: String!
    $id: String!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      persistedQuery(appId: $appId, id: $id) {
        id
        query
        allowedOperationNames
        description
        freeVariables
        fixedVariables
        tags
      }
    }
  }
  
  mutation CreateCLISessionMutation(
    $nfToken: String!
    $appId: String!
    $name: String!
    $metadata: JSON
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      createNetlifyCliSession(
        input: { appId: $appId, name: $name, metadata: metadata }
      ) {
        session {
          id
          appId
          netlifyUserId
          name
        }
      }
    }
  }
  
  mutation UpdateCLISessionMetadataMutation(
    $nfToken: String!
    $sessionId: String!
    $metadata: JSON!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      updateNetlifyCliSession(
        input: { id: $sessionId, metadata: $metadata }
      ) {
        session {
          id
          name
          metadata
        }
      }
    }
  }
  
  mutation CreateCLISessionEventMutation(
    $nfToken: String!
    $sessionId: String!
    $payload: JSON!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      createNetlifyCliTestEvent(
        input: {
          data: { payload: $payload }
          sessionId: $sessionId
        }
      ) {
        event {
          id
          createdAt
          sessionId
        }
      }
    }
  }
  
query CLISessionEventsQuery(
  $nfToken: String!
  $sessionId: String!
  $first: Int!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    netlifyCliEvents(sessionId: $sessionId, first: $first) {
      __typename
      createdAt
      id
      sessionId
      ... on OneGraphNetlifyCliSessionLogEvent {
        id
        message
        sessionId
        createdAt
      }
      ... on OneGraphNetlifyCliSessionTestEvent {
        id
        createdAt
        payload
        sessionId
      }
    }
  }
}
  
mutation AckCLISessionEventMutation(
  $nfToken: String!
  $sessionId: String!
  $eventIds: [String!]!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    ackNetlifyCliEvents(
      input: { eventIds: $eventIds, sessionId: $sessionId }
    ) {
      events {
        id
      }
    }
  }
}

query AppSchemaQuery(
  $nfToken: String!
  $appId: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    app(id: $appId) {
      graphQLSchema {
        appId
        createdAt
        id
        services {
          friendlyServiceName
          logoUrl
          service
          slug
          supportsCustomRedirectUri
          supportsCustomServiceAuth
          supportsOauthLogin
        }
        updatedAt
      }
    }
  }
}

mutation UpsertAppForSiteMutation(
  $nfToken: String!
  $siteId: String!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    upsertAppForNetlifySite(
      input: { netlifySiteId: $siteId }
    ) {
      org {
        id
        name
      }
      app {
        id
        name
        corsOrigins
        customCorsOrigins {
          friendlyServiceName
          displayName
          encodedValue
        }
      }
    }
  }
}

mutation CreateNewSchemaMutation(
  $nfToken: String!
  $input: OneGraphCreateGraphQLSchemaInput!
) {
  oneGraph(
    auths: { netlifyAuth: { oauthToken: $nfToken } }
  ) {
    createGraphQLSchema(input: $input) {
      app {
        graphQLSchema {
          id
        }
      }
      graphqlSchema {
        id
        services {
          friendlyServiceName
          logoUrl
          service
          slug
          supportsCustomRedirectUri
          supportsCustomServiceAuth
          supportsOauthLogin
        }
      }
    }
  }
}`

const fetchPersistedQuery = async (authToken, appId, docId) => {
  const response = await fetchOneGraph(authToken, ONEDASH_APP_ID, internalOperationsDoc, 'PersistedQueryQuery', {
    nfToken: authToken,
    appId,
    id: docId,
  })

  const persistedQuery = response.data && response.data.oneGraph && response.data.oneGraph.persistedQuery

  return persistedQuery
}

const monitorCLISessionEvents = ({ appId, authToken, netligraphConfig, onClose, onError, onEvents, sessionId, state }) => {
  const frequency = 5000
  let shouldClose = false

  const enabledServiceWatcher = async (netlifyToken, siteId) => {
    const enabledServices = state.get('oneGraphEnabledServices') || ['onegraph']
    const enabledServicesInfo = await fetchEnabledServices(netlifyToken, siteId)
    if (!enabledServicesInfo) {
      console.warn("Unable to fetch enabled services for site for code generation")
      return
    }
    const newEnabledServices = enabledServicesInfo.map((service) => service.service)
    const enabledServicesCompareKey = enabledServices.sort().join(',')
    const newEnabledServicesCompareKey = newEnabledServices.sort().join(',')

    if (enabledServicesCompareKey !== newEnabledServicesCompareKey) {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} Netligraph schema..., ${enabledServicesCompareKey} => ${newEnabledServicesCompareKey}`)
      await refetchAndGenerateFromOneGraph({ netligraphConfig, state, netlifyToken, siteId })
      log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} Netligraph schema and regenerated functions`)
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

    const first = 1000
    const next = await fetchOneGraph(null, appId, internalOperationsDoc, 'CLISessionEventsQuery', {
      nfToken: authToken,
      sessionId,
      first,
    })

    if (next.errors) {
      next.errors.forEach((error) => {
        onError(error)
      })
    }

    const events = (next.data && next.data.oneGraph && next.data.oneGraph.netlifyCliEvents) || []

    if (events.length !== 0) {
      const ackIds = onEvents(events)
      await fetchOneGraph(authToken, appId, internalOperationsDoc, 'AckCLISessionEventMutation', {
        nfToken: authToken,
        sessionId,
        eventIds: ackIds,
      })
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
    metadata
  }

  const result = await fetchOneGraph(null, appId, internalOperationsDoc, 'CreateCLISessionMutation', payload)

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createNetlifyCliSession &&
    result.data.oneGraph.createNetlifyCliSession.session

  return session
}

const updateCLISessionMetadata = async (netlifyToken, appId, sessionId, metadata) => {
  const result = await fetchOneGraph(null, appId, internalOperationsDoc, 'UpdateCLISessionMetadataMutation', {
    nfToken: netlifyToken,
    sessionId,
    metadata
  })

  const session =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.updateNetlifyCliSession &&
    result.data.oneGraph.updateNetlifyCliSession.session

  return session
}

const ackCLISessionEvents = async (netlifyToken, appId, sessionId, first) => {
  const result = await fetchOneGraph(null, appId, internalOperationsDoc, 'AckCLISessionEventMutation', {
    nfToken: netlifyToken,
    sessionId,
    first,
  })

  const events = result.data && result.data.oneGraph && result.data.oneGraph.ackNetlifyCliEvents

  return events
}

const createPersistedQuery = async (netlifyToken, { appId, description, document, tags }) => {
  const result = await fetchOneGraph(null, appId, internalOperationsDoc, 'CreatePersistedQueryMutation', {
    nfToken: netlifyToken,
    appId,
    query: document,
    tags,
    description,
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
    console.warn("Unable to fetch enabled services for site for code generation")
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

  const updateGraphQLOperationsFile = async (docId) => {
    const persistedDoc = await fetchPersistedQuery(netlifyToken, site.id, docId)
    if (!persistedDoc) {
      console.warn('No persisted doc found for:', docId)
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
        return `Sync Netligraph operations library`
      default: {
        return `Unrecognized event (${__typename})`
      }
    }
  }

  const handleEvent = async (event) => {
    const { __typename, payload } = await event
    switch (__typename) {
      case 'OneGraphNetlifyCliSessionTestEvent':
        await handleEvent(payload)
        break
      case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
        await generateHandler(netligraphConfig, schema, payload.operationId, payload)
        break
      case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
        await updateGraphQLOperationsFile(payload.docId)
        break
      default: {
        console.log('Unrecognized event received', __typename, payload)
        break
      }
    }
  }

  monitorCLISessionEvents({
    appId: site.id,
    authToken: netlifyToken,
    netligraphConfig,
    sessionId: oneGraphSessionId,
    state,
    onEvents: (events) => {
      events.forEach(async (event) => {
        const eventName = friendlyEventName(event)
        log(`${NETLIFYDEVLOG} ${chalk.magenta('Handling')} Netligraph event: ${eventName}...`)
        await handleEvent(event)
        log(`${NETLIFYDEVLOG} ${chalk.green('Finished handling')} Netligraph event: ${eventName}...`)
      })
      return events.map((event) => event.id)
    },
    onError: (error) => {
      console.error(`OneGraph: ${error}`)
    },
    onClose: () => {
      console.log('OneGraph: closed')
    },
  })
}

const fetchAppSchema = async (authToken, siteId) => {
  const result = await fetchOneGraph(authToken, siteId, internalOperationsDoc, 'AppSchemaQuery', {
    nfToken: authToken,
    appId: siteId,
  })

  return dotProp.get(result, 'data.oneGraph.app.graphQLSchema')
}

const upsertAppForSite = async (authToken, siteId) => {
  const result = await fetchOneGraph(authToken, ONEDASH_APP_ID, internalOperationsDoc, 'UpsertAppForSiteMutation', {
    nfToken: authToken,
    siteId,
  })

  return dotProp.get(result, 'data.oneGraph.upsertAppForNetlifySite.app')
}

const createNewAppSchema = async (nfToken, input) => {
  const result = await fetchOneGraph(null, input.appId, internalOperationsDoc, 'CreateNewSchemaMutation', {
    nfToken,
    input,
  })

  return dotProp.get(result, 'data.oneGraph.createGraphQLSchema.graphqlSchema')
}

const ensureAppForSite = async (authToken, siteId) => {
  const app = await upsertAppForSite(authToken, siteId)
  const schema = await fetchAppSchema(authToken, app.id)
  if (!schema) {
    console.log('Creating new empty default GraphQL schema for site....')
    await createNewAppSchema(authToken, {
      appId: siteId,
      enabledServices: ['ONEGRAPH'],
      setAsDefaultForApp: true,
    })
  }
}

const fetchEnabledServices = async (authToken, appId) => {
  const appSchema = await fetchAppSchema(authToken, appId)
  return dotProp.get(appSchema, 'services')
}

const generateSessionName = () => {
  const userInfo = os.userInfo('utf-8')
  const sessionName = `${userInfo.username}-${Date.now()}`
  console.log(`${NETLIFYDEVLOG} Generated netligraph session name: ${sessionName}`)
  return sessionName
}

module.exports = {
  ackCLISessionEvents,
  createCLISession,
  createPersistedQuery,
  ensureAppForSite,
  fetchOneGraphPersisted,
  fetchOneGraphSchemaJson,
  fetchOneGraphSchema,
  fetchPersistedQuery,
  generateSessionName,
  loadCLISession,
  monitorCLISessionEvents,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
  updateCLISessionMetadata,
  upsertAppForSite,
}
