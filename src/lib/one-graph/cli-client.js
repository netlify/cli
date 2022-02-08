// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const crypto = require('crypto')
const os = require('os')
const path = require('path')

const gitRepoInfo = require('git-repo-info')
const { GraphQL, InternalConsole, OneGraphClient } = require('netlify-onegraph-internal')
const { NetlifyGraph } = require('netlify-onegraph-internal')

// eslint-disable-next-line no-unused-vars
const { StateConfig, chalk, error, log, warn } = require('../../utils')
const { watchDebounced } = require('../functions/watcher')

const {
  generateFunctionsFile,
  generateHandlerByOperationId,
  readGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
} = require('./cli-netlify-graph')

const { parse } = GraphQL
const { defaultExampleOperationsDoc, extractFunctionsFromOperationDoc } = NetlifyGraph
const { createCLISession, createPersistedQuery, ensureAppForSite, updateCLISessionMetadata } = OneGraphClient

const internalConsole = {
  log,
  warn,
  error,
  debug: console.debug,
}

/**
 * Keep track of which document hashes we've received from the server so we can ignore events from the filesystem based on them
 */
const witnessedIncomingDocumentHashes = []

InternalConsole.registerConsole(internalConsole)

/**
 * Start polling for CLI events for a given session to process locally
 * @param {object} input
 * @param {string} input.appId The app to query against, typically the siteId
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {function} input.onClose A function to call when the polling loop is closed
 * @param {function} input.onError A function to call when an error occurs
 * @param {function} input.onEvents A function to call when CLI events are received and need to be processed
 * @param {string} input.sessionId The session id to monitor CLI events for
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
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
 * Monitor the operations document for changes
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {() => void} input.onAdd A callback function to handle when the operations document is added
 * @param {() => void} input.onChange A callback function to handle when the operations document is changed
 * @param {() => void=} input.onUnlink A callback function to handle when the operations document is unlinked
 * @returns {Promise<any>}
 */
const monitorOperationFile = async ({ netlifyGraphConfig, onAdd, onChange, onUnlink }) => {
  const filePath = path.resolve(...netlifyGraphConfig.graphQLOperationsSourceFilename)
  const newWatcher = await watchDebounced([filePath], {
    depth: 1,
    onAdd,
    onChange,
    onUnlink,
  })

  return newWatcher
}

/**
 * Fetch the schema for a site, and regenerate all of the downstream files
 * @param {object} input
 * @param {string} input.siteId The id of the site to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
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
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile({ netlifyGraphConfig, schema, operationsDoc: currentOperationsDoc, functions, fragments })
  writeGraphQLSchemaFile(netlifyGraphConfig, schema)
  state.set('oneGraphEnabledServices', enabledServices)
}

/**
 * Regenerate the function library based on the current operations document on disk
 * @param {object} input
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const regenerateFunctionsFileFromOperationsFile = (input) => {
  const { netlifyGraphConfig, schema } = input

  const appOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)

  const hash = quickHash(appOperationsDoc)

  if (witnessedIncomingDocumentHashes.includes(hash)) {
    // We've already seen this document, so don't regenerate
    return
  }

  const parsedDoc = parse(appOperationsDoc, {
    noLocation: true,
  })
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)
  generateFunctionsFile({ netlifyGraphConfig, schema, operationsDoc: appOperationsDoc, functions, fragments })
}

/**
 * Compute a md5 hash of a string
 * @param {string} input String to compute a quick md5 hash for
 * @returns hex digest of the input string
 */
const quickHash = (input) => {
  const hashSum = crypto.createHash('md5')
  hashSum.update(input)
  return hashSum.digest('hex')
}

/**
 * Fetch a persisted operations doc by its id, write it to the system, and regenerate the library
 * @param {object} input
 * @param {string} input.siteId The site id to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFileFromPersistedDoc = async (input) => {
  const { docId, netlifyGraphConfig, netlifyToken, schema, siteId } = input
  const persistedDoc = await OneGraphClient.fetchPersistedQuery(netlifyToken, siteId, docId)
  if (!persistedDoc) {
    warn(`No persisted doc found for: ${docId}`)
    return
  }

  const doc = persistedDoc.query

  writeGraphQLOperationsSourceFile(netlifyGraphConfig, doc)
  regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })

  const hash = quickHash(doc)

  const relevantHasLength = 10

  if (witnessedIncomingDocumentHashes.length > relevantHasLength) {
    witnessedIncomingDocumentHashes.shift()
  }

  witnessedIncomingDocumentHashes.push(hash)
}

const handleCliSessionEvent = async ({ event, netlifyGraphConfig, netlifyToken, schema, siteId }) => {
  const { __typename, payload } = await event
  switch (__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent':
      await handleCliSessionEvent({ netlifyToken, event: payload, netlifyGraphConfig, schema, siteId })
      break
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent':
      if (!payload.operationId || !payload.operationId.id) {
        warn(`No operation id found in payload, ${JSON.stringify(payload, null, 2)}`)
        return
      }
      generateHandlerByOperationId(netlifyGraphConfig, schema, payload.operationId.id, payload)
      break
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
      await updateGraphQLOperationsFileFromPersistedDoc({
        netlifyToken,
        docId: payload.docId,
        netlifyGraphConfig,
        schema,
        siteId,
      })
      break
    default: {
      warn(
        `Unrecognized event received, you may need to upgrade your CLI version: ${__typename}: ${JSON.stringify(
          payload,
          null,
          2,
        )}`,
      )
      break
    }
  }
}

const persistNewOperationsDocForSession = async ({ netlifyToken, oneGraphSessionId, operationsDoc, siteId }) => {
  const { branch } = gitRepoInfo()

  const payload = {
    appId: siteId,
    description: 'Temporary snapshot of local queries',
    document: operationsDoc,
    tags: ['netlify-cli', `session:${oneGraphSessionId}`, `git-branch:${branch}`, `local-change`],
  }
  const persistedDoc = await createPersistedQuery(netlifyToken, payload)
  const newMetadata = await { docId: persistedDoc.id }
  const result = await OneGraphClient.updateCLISessionMetadata(netlifyToken, siteId, oneGraphSessionId, newMetadata)

  if (result.errors) {
    warn(`Unable to update session metadata with updated operations doc ${JSON.stringify(result.errors, null, 2)}`)
  }
}

/**
 * Load the CLI session id from the local state
 * @param {StateConfig} state
 * @returns
 */
const loadCLISession = (state) => state.get('oneGraphSessionId')

/**
 * Idemponentially save the CLI session id to the local state and start monitoring for CLI events, upstream schema changes, and local operation file changes
 * @param {object} input
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
 * @param {any} input.site The site object
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

  monitorOperationFile({
    netlifyGraphConfig,
    onChange: async (filePath) => {
      log('NetlifyGraph operation file changed at', filePath, 'updating function library...')
      regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: newOperationsDoc,
        siteId: site.id,
      })
    },
    onAdd: async (filePath) => {
      log('NetlifyGraph operation file created at', filePath, 'creating function library...')
      regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: newOperationsDoc,
        siteId: site.id,
      })
    },
  })

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
  extractFunctionsFromOperationDoc,
  handleCliSessionEvent,
  generateSessionName,
  loadCLISession,
  monitorCLISessionEvents,
  persistNewOperationsDocForSession,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
}
