/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
const { buildClientSchema } = require('graphql')
const fetch = require('node-fetch')

const { extractFunctionsFromOperationDoc, generateFunctionsFile, generateHandler, netligraphPath, readAndParseGraphQLOperationsSourceFile, writeGraphQLOperationsSourceFile, readGraphQLOperationsSourceFile } = require("./netligraph")

const ONEDASH_APP_ID = '0b066ba6-ed39-4db8-a497-ba0be34d5b2a'

// We mock out onegraph-auth to provide just enough functionality to work with server-side auth tokens
const makeAuth = (appId, authToken) => ({
  appId,
  authHeaders: () => ({ "Authorization": `Bearer ${authToken}` }),
  accessToken: () => ({ accessToken: authToken }),
});

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
    body: reqBody
  })

  const respBody = await resp.text()

  if (resp.status < httpOkLow || resp.status > httpOkHigh) {
    console.warn("Response:", respBody)
    throw (new Error(
      `Netlify OneGraph return non - OK HTTP status code: ${resp.status}`,
    ))
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
      body: null
    })

    return JSON.parse(response)
  } catch (error) {
    console.error("Error fetching schema:", error)
  }
}

const fetchOneGraphSchema = async (appId, enabledServices) => {
  const result = await fetchOneGraphSchemaJson(appId, enabledServices);
  const schema = buildClientSchema(result.data);
  return schema
}

const fetchOneGraph = async (
  accessToken,
  appId,
  query,
  operationName,
  variables
  // eslint-disable-next-line max-params
) => {
  const payload = {
    query,
    variables,
    operationName,
  }

  const body = JSON.stringify(payload);

  const result = await basicPost(
    `https://serve.onegraph.com/graphql?app_id=${appId}`,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body,
    }
  )

  // @ts-ignore
  const value = JSON.parse(result)
  if (value.errors) {
    console.log("fetchOneGraph errors", JSON.stringify(value, null, 2))
  }
  return value
}

const fetchOneGraphPersisted = async (
  appId,
  accessToken,
  docId,
  operationName,
  variables
  // eslint-disable-next-line max-params
) => {
  const payload = {
    doc_id: docId,
    variables,
    operationName,
  }

  const result = await basicPost(
    `https://serve.onegraph.com/graphql?app_id=${appId}`,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : '',
      },
      body: JSON.stringify(payload),
    }
  )

  return JSON.parse(result)
}

const operationsDoc = `mutation CreatePersistedQueryMutation(
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
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      createNetlifyCliSession(
        input: { appId: $appId, name: $name }
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
}`

const fetchPersistedQuery = async (
  authToken,
  appId,
  docId,
) => {
  const response = await fetchOneGraph(
    authToken,
    ONEDASH_APP_ID,
    operationsDoc,
    'PersistedQueryQuery',
    {
      nfToken: authToken,
      appId,
      id: docId,
    },
  )

  const persistedQuery =
    response.data
    && response.data.oneGraph
    && response.data.oneGraph.persistedQuery

  return persistedQuery
}

const monitorCLISessionEvents = (
  appId,
  authToken,
  sessionId,
  { onClose, onError, onEvents, }
) => {
  const frequency = 5000
  let shouldClose = false

  const close = () => {
    shouldClose = true
  }

  // TODO: Convert this to recursive setTimeout
  const handle = setInterval(async () => {
    if (shouldClose) {
      clearInterval(handle)
      onClose()
    }

    const first = 1000
    const next = await fetchOneGraph(
      authToken,
      appId,
      operationsDoc,
      'CLISessionEventsQuery',
      {
        nfToken: authToken,
        sessionId,
        first,
      },
    )

    if (next.errors) {
      next.errors.forEach(error => {
        onError(error)
      })
    }

    const events =
      next.data
      && next.data.oneGraph
      && next.data.oneGraph.netlifyCliEvents || []

    if (events.length !== 0) {
      const ackIds = onEvents(events)
      await fetchOneGraph(
        authToken,
        appId,
        operationsDoc,
        'AckCLISessionEventMutation',
        {
          nfToken: authToken,
          sessionId,
          eventIds: ackIds,
        },
      )
    }
  }, frequency)

  return close
}

const createCLISession = async (
  netlifyToken,
  appId,
  name,
) => {
  const result = await fetchOneGraph(
    null,
    appId,
    operationsDoc,
    'CreateCLISessionMutation',
    {
      nfToken: netlifyToken,
      appId,
      name,
    },
  )

  const session = result.data
    && result.data.oneGraph
    && result.data.oneGraph.createNetlifyCliSession
    && result.data.oneGraph.createNetlifyCliSession.session

  return session
}

const fetchCLISessionEvents = async (
  netlifyToken,
  appId,
  sessionId,
  first,
) => {
  const result = await fetchOneGraph(
    null,
    appId,
    operationsDoc,
    'CLISessionEventsQuery',
    {
      nfToken: netlifyToken,
      sessionId,
      first,
    },
  )

  const events =
    result.data
    && result.data.oneGraph
    && result.data.oneGraph.netlifyCliEvents

  return events
}


const ackCLISessionEvents = async (
  netlifyToken,
  appId,
  sessionId,
  first,
) => {
  const result = await fetchOneGraph(
    null,
    appId,
    operationsDoc,
    'AckCLISessionEventMutation',
    {
      nfToken: netlifyToken,
      sessionId,
      first,
    },
  )

  const events =
    result.data
    && result.data.oneGraph
    && result.data.oneGraph.ackNetlifyCliEvents

  return events
}

const createPersistedQuery = async (
  netlifyToken,
  { appId,
    description,
    document,
    tags }
) => {
  const result = await fetchOneGraph(
    null,
    appId,
    operationsDoc,
    'CreatePersistedQueryMutation',
    {
      nfToken: netlifyToken,
      appId,
      query: document,
      tags,
      description
    },
  )

  const persistedQuery =
    result.data
    && result.data.oneGraph
    && result.data.oneGraph.createPersistedQuery
    && result.data.oneGraph.createPersistedQuery.persistedQuery

  return persistedQuery
}

const loadCLISession = (state) =>
  state.get('oneGraphSessionId')

const startOneGraphCLISession = async ({ netlifyToken, site, state }) => {
  let oneGraphSessionId = loadCLISession(state)
  if (!oneGraphSessionId) {
    const oneGraphSession = await createCLISession(netlifyToken, site.id, "testing")
    state.set('oneGraphSessionId', oneGraphSession.id)
    oneGraphSessionId = state.get('oneGraphSessionId')
  }

  const enabledServices = ['npm', 'github', 'rss']
  const schema = await fetchOneGraphSchema(site.id, enabledServices)

  const updateGraphQLOperationsFile = async (docId) => {
    const persistedDoc = await fetchPersistedQuery(netlifyToken, site.id, docId)
    if (!persistedDoc) {
      console.warn("No persisted doc found for:", docId)
      return
    }

    const doc = persistedDoc.query
    writeGraphQLOperationsSourceFile(netligraphPath, doc)
    const [parsedDoc] = readAndParseGraphQLOperationsSourceFile(netligraphPath)
    const appOperationsDoc = readGraphQLOperationsSourceFile(netligraphPath)
    const operations = extractFunctionsFromOperationDoc(parsedDoc)
    generateFunctionsFile(netligraphPath, schema, appOperationsDoc, operations)
    console.info("Regenerated netligraph functions files")
  }

  const handleEvent = async (event) => {
    const { __typename, payload } = await event
    switch (__typename) {
      case 'OneGraphNetlifyCliSessionTestEvent':
        handleEvent(payload)
        break;
      case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
        generateHandler(netligraphPath, schema, payload.operationId, payload)
        break;
      case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
        updateGraphQLOperationsFile(payload.docId)
        break;
      default: {
        console.log("Unrecognized event received", __typename, payload)
        break
      }
    }
  }

  monitorCLISessionEvents(site.id, netlifyToken, oneGraphSessionId,
    {
      onEvents: (events) => {
        console.time("events:process")
        events.forEach(handleEvent)
        console.timeEnd("events:process")
        return events.map(event => event.id)
      },
      onError: (error) => {
        console.error(`OneGraph: ${error}`)
      },
      onClose: () => {
        console.log("OneGraph: closed")
      }
    })
}


module.exports = {
  ackCLISessionEvents,
  createCLISession,
  createPersistedQuery,
  fetchOneGraphPersisted,
  fetchOneGraphSchemaJson,
  fetchOneGraphSchema,
  fetchPersistedQuery,
  loadCLISession,
  monitorCLISessionEvents,
  startOneGraphCLISession
}