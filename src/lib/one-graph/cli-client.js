// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const gitRepoInfo = require('git-repo-info')
const { GraphQL, InternalConsole, OneGraphClient } = require('netlify-onegraph-internal')
const { NetlifyGraph } = require('netlify-onegraph-internal')

// eslint-disable-next-line no-unused-vars
const { StateConfig, USER_AGENT, chalk, error, log, warn, watchDebounced } = require('../../utils')

const {
  generateFunctionsFile,
  generateHandlerByOperationId,
  normalizeOperationsDoc,
  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles,
  readGraphQLOperationsSourceFiles,
  writeGraphQLOperationsSourceFiles,
  writeGraphQLSchemaFile,
} = require('./cli-netlify-graph')

const { parse } = GraphQL
const { defaultExampleOperationsDoc, extractFunctionsFromOperationDoc } = NetlifyGraph
const {
  ensureAppForSite,
  executeCreatePersistedQueryMutation,
  executeMarkCliSessionActiveHeartbeat,
  executeMarkCliSessionInactive,
  updateCLISessionMetadata,
} = OneGraphClient

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
 * @param {any} input.site The site object
 * @returns
 */
const monitorCLISessionEvents = (input) => {
  const { appId, netlifyGraphConfig, netlifyToken, onClose, onError, onEvents, sessionId, site } = input

  let netlifyGraphJson = readNetlifyGraphJson({ siteRoot: site.root })

  const frequency = 5000
  // 30 minutes
  const defaultHeartbeatFrequency = 1_800_000
  let shouldClose = false
  let nextMarkActiveHeartbeat = defaultHeartbeatFrequency

  const markActiveHelper = async () => {
    const fullSession = await OneGraphClient.fetchCliSession({ authToken: netlifyToken, appId, sessionId })
    // @ts-ignore
    const heartbeatIntervalms = fullSession.session.cliHeartbeatIntervalMs || defaultHeartbeatFrequency
    nextMarkActiveHeartbeat = heartbeatIntervalms
    const markCLISessionActiveResult = await executeMarkCliSessionActiveHeartbeat(netlifyToken, site.id, sessionId)
    if (markCLISessionActiveResult.errors && markCLISessionActiveResult.errors.length !== 0) {
      warn(`Failed to mark CLI session active: ${markCLISessionActiveResult.errors.join(', ')}`)
    }
    setTimeout(markActiveHelper, nextMarkActiveHeartbeat)
  }

  setTimeout(markActiveHelper, nextMarkActiveHeartbeat)

  const close = () => {
    shouldClose = true
  }

  // TODO: In the morning, switch to polling for the CLI session metadata,
  // and update the UI to change the schemaId in the metadata whenever services are updated
  // Then in the polling just check the current schemaId and with the polled metadata,
  // and refetch/regenerate/update the files if the schemaId has changed

  const enabledServiceWatcher = async (innerNetlifyToken, siteId) => {
    const schemaResult = await OneGraphClient.fetchAppSchemaQuery(
      {
        appId: site.id,
        nfToken: netlifyToken,
      },
      {
        siteId,
      },
    )

    if (schemaResult.errors) {
      warn(`Unable to fetch current schema: ${JSON.stringify(schemaResult, null, 2)}`)
      return
    }

    const newSchema = schemaResult.data.oneGraph.app.graphQLSchema.services

    if (newSchema.id !== netlifyGraphJson.schemaId) {
      const newEnabledServices = newSchema.services.map((service) => service.service).sort()
      log(`${chalk.magenta('Reloading')} Netlify Graph schema...,`)
      netlifyGraphJson = {
        ...netlifyGraphJson,
        schemaId: newSchema.id,
        enabledServices: newEnabledServices,
      }

      writeNetlifyGraphJson({ siteRoot: site.root, netlifyGraphJson })

      await refetchAndGenerateFromOneGraph({
        netlifyGraphConfig,
        site,
        netlifyToken: innerNetlifyToken,
        schemaId: newSchema.id,
      })
      log(`${chalk.green('Reloaded')} Netlify Graph schema and regenerated functions`)
    }

    let handle

    const helper = async () => {
      if (shouldClose) {
        clearTimeout(handle)
        onClose && onClose()
      }

      const next = await OneGraphClient.fetchCliSessionEvents({ appId, authToken: netlifyToken, sessionId })

      if (next.errors) {
        next.errors.forEach((fetchEventError) => {
          onError(fetchEventError)
        })
      }

      const { events } = next

      if (events.length !== 0) {
        let ackIds = []
        try {
          ackIds = await onEvents(events)
        } catch (eventHandlerError) {
          warn(`Error handling event: ${eventHandlerError} `)
        } finally {
          await OneGraphClient.ackCLISessionEvents({ appId, authToken: netlifyToken, sessionId, eventIds: ackIds })
        }
      }

      await enabledServiceWatcher(netlifyToken, appId)

      handle = setTimeout(helper, frequency)
    }

    // Fire immediately to start rather than waiting the initial `frequency`
    helper()

    return close
  }

  return enabledServiceWatcher
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
  const filePath = path.resolve(...netlifyGraphConfig.graphQLOperationsSourceDirectory)
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
 * @param {any} input.site The site object
 * @param {string} input.schemaId The id of the schema to fetch
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>}
 */
const refetchAndGenerateFromOneGraph = async (input) => {
  const { logger, netlifyGraphConfig, netlifyToken, site } = input
  const siteId = site.id
  await OneGraphClient.ensureAppForSite(netlifyToken, siteId)

  let newSchema

  try {
    newSchema = await OneGraphClient.fetchOneGraphSchemaById({
      accessToken: netlifyToken,
      schemaId: input.schemaId,
      siteId,
    })
  } catch (fetchSchemaError) {
    error(`Failed to fetch schema: ${fetchSchemaError}`)
  }

  const schemaMetadataResult = await OneGraphClient.fetchAppSchemaQuery(
    {
      appId: siteId,
      nfToken: netlifyToken,
    },
    {
      siteId,
    },
  )

  if (schemaMetadataResult.errors) {
    warn(`Unable to fetch current schema metadata: ${JSON.stringify(schemaMetadataResult, null, 2)}`)
    return
  }

  const newSchemaMetadata = schemaMetadataResult.data.oneGraph.app.graphQLSchema

  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles(netlifyGraphConfig)

  let currentOperationsDoc = readGraphQLOperationsSourceFiles(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile({
    logger,
    netlifyGraphConfig,
    schema: newSchema,
    operationsDoc: currentOperationsDoc,
    functions,
    fragments,
  })
  writeGraphQLSchemaFile({ logger, netlifyGraphConfig, schema: newSchema })

  const enabledServices = newSchemaMetadata.services
    .map((service) => service.service)
    .sort((aString, bString) => aString.localeCompare(bString))

  let netlifyGraphJson = readNetlifyGraphJson({ siteRoot: site.root })

  netlifyGraphJson = {
    ...netlifyGraphJson,
    schemaId: newSchemaMetadata.id,
    enabledServices,
  }

  writeNetlifyGraphJson({ siteRoot: site.root, netlifyGraphJson })
}

/**
 * Regenerate the function library based on the current operations document on disk
 * @param {object} input
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const regenerateFunctionsFileFromOperationsFiles = (input) => {
  const { netlifyGraphConfig, schema } = input

  const appOperationsDoc = readGraphQLOperationsSourceFiles(netlifyGraphConfig)

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
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFileFromPersistedDoc = async (input) => {
  const { docId, logger, netlifyGraphConfig, netlifyToken, schema, siteId } = input
  const persistedDoc = await OneGraphClient.fetchPersistedQuery(netlifyToken, siteId, docId)
  if (!persistedDoc) {
    warn(`No persisted doc found for: ${docId} `)
    return
  }

  // Sorts the operations stably, prepends the @netlify directive, etc.
  const operationsDocString = normalizeOperationsDoc(persistedDoc.query)

  writeGraphQLOperationsSourceFiles({ logger, netlifyGraphConfig, operationsDocString })
  regenerateFunctionsFileFromOperationsFiles({ netlifyGraphConfig, schema })

  const hash = quickHash(operationsDocString)

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
        warn(`No operation id found in payload, ${JSON.stringify(payload, null, 2)} `)
        return
      }
      generateHandlerByOperationId({
        netlifyGraphConfig,
        schema,
        operationId: payload.operationId.id,
        handlerOptions: payload,
      })
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
        )} `,
      )
      break
    }
  }
}

/**
 *
 * @param {object} input
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {object} input.siteId The site object that contains the root file path for the site
 */
const getCLISession = async ({ netlifyToken, oneGraphSessionId, siteId }) => {
  const input = {
    appId: siteId,
    sessionId: oneGraphSessionId,
    authToken: netlifyToken,
    desiredEventCount: 1,
  }
  return await OneGraphClient.fetchCliSession(input)
}

/**
 *
 * @param {object} input
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteId The site object that contains the root file path for the site
 */
const getCLISessionMetadata = async ({ netlifyToken, oneGraphSessionId, siteId }) => {
  const { errors, session } = await getCLISession({ netlifyToken, oneGraphSessionId, siteId })
  return { metadata: session && session.metadata, errors }
}

/**
 * Look at the current project, filesystem, etc. and determine relevant metadata for a cli session
 * @param {object} input
 * @param {string} input.siteRoot The root file path for the site
 * @returns {Record<string, any>} Any locally detected facts that are relevant to include in the cli session metadata
 */
const detectLocalCLISessionMetadata = ({ siteRoot }) => {
  const { branch } = gitRepoInfo()
  const hostname = os.hostname()
  const userInfo = os.userInfo({ encoding: 'utf-8' })
  const { username } = userInfo
  const cliVersion = USER_AGENT
  const netlifyGraphJson = readNetlifyGraphJson({ siteRoot })

  const detectedMetadata = {
    gitBranch: branch,
    hostname,
    username,
    siteRoot,
    cliVersion,
    schemaId: netlifyGraphJson.schemaId,
  }

  return detectedMetadata
}

/**
 * Fetch the existing cli session metadata if it exists, and mutate it remotely with the passed in metadata
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteId The site object that contains the root file path for the site
 * @param {string} input.siteRoot The root file path for the site
 * @param {object} input.newMetadata The metadata to merge into (with priority) the existing metadata
 * @returns {Promise<object>}
 */
const upsertMergeCLISessionMetadata = async ({ netlifyToken, newMetadata, oneGraphSessionId, siteId, siteRoot }) => {
  const { errors, metadata } = await getCLISessionMetadata({ netlifyToken, oneGraphSessionId, siteId })
  if (errors) {
    warn(`Error fetching cli session metadata: ${JSON.stringify(errors, null, 2)} `)
  }

  const detectedMetadata = detectLocalCLISessionMetadata({ siteRoot })

  // @ts-ignore
  const finalMetadata = { ...metadata, ...detectedMetadata, ...newMetadata }
  return OneGraphClient.updateCLISessionMetadata(netlifyToken, siteId, oneGraphSessionId, finalMetadata)
}

const persistNewOperationsDocForSession = async ({
  netlifyGraphConfig,
  netlifyToken,
  oneGraphSessionId,
  operationsDoc,
  siteId,
  siteRoot,
}) => {
  const { branch } = gitRepoInfo()
  const persistedResult = await executeCreatePersistedQueryMutation(
    {
      nfToken: netlifyToken,
      appId: siteId,
      description: 'Temporary snapshot of local queries',
      query: operationsDoc,
      tags: ['netlify-cli', `session:${oneGraphSessionId} `, `git - branch:${branch} `, `local - change`],
    },
    {
      accessToken: netlifyToken,
      siteId,
    },
  )

  const persistedDoc =
    persistedResult.data &&
    persistedResult.data.oneGraph &&
    persistedResult.data.oneGraph.createPersistedQuery &&
    persistedResult.data.oneGraph.createPersistedQuery.persistedQuery

  if (!persistedDoc) {
    warn(`Failed to create persisted query for editing, ${JSON.stringify(persistedResult, null, 2)}`)
  }

  const newMetadata = await { docId: persistedDoc.id }
  const result = await upsertMergeCLISessionMetadata({
    netlifyGraphConfig,
    netlifyToken,
    siteId,
    oneGraphSessionId,
    newMetadata,
    siteRoot,
  })

  if (result.errors) {
    warn(`Unable to update session metadata with updated operations doc ${JSON.stringify(result.errors, null, 2)} `)
  }
}

const createCLISession = ({ metadata, netlifyToken, sessionName, siteId }) => {
  const result = OneGraphClient.createCLISession(netlifyToken, siteId, sessionName, metadata)
  return result
}

/**
 * Load the CLI session id from the local state
 * @param {StateConfig} state
 * @returns
 */
const loadCLISession = (state) => state.get('oneGraphSessionId')

const NETLIFY_GRAPH_JSON_FILENAME = 'netlifyGraph.json'

/**
 * Ensure the local Netlify Graph JSON file exists, and load it
 * @params {string} input.siteRoot The root file path for the site
 * @returns {object}
 */
const readNetlifyGraphJson = ({ siteRoot }) => {
  const filePath = path.join(siteRoot, NETLIFY_GRAPH_JSON_FILENAME)
  if (!fs.existsSync(filePath)) {
    // Create an empty json file and write it to disk
    const emptyJson = {}
    fs.writeFileSync(filePath, JSON.stringify(emptyJson, null, 2))
  }

  const content = (fs.readFileSync(filePath, 'utf8') || '').trim()

  return JSON.parse(content)
}

/**
 * Ensure the local Netlify Graph JSON file exists, and load it
 * @params {object} input
 * @params {object} input.netlifyGraphJson JSON object to write to disk
 * @params {string} input.siteRoot The root file path for the site
 * @returns {object}
 */
const writeNetlifyGraphJson = ({ netlifyGraphJson, siteRoot }) => {
  const filePath = path.join(siteRoot, NETLIFY_GRAPH_JSON_FILENAME)
  fs.writeFileSync(filePath, JSON.stringify(netlifyGraphJson, null, 2))
}

const ensureSchemaForApp = async ({ netlifyToken, site }) => {
  let netlifyGraphJson = readNetlifyGraphJson({ siteRoot: site.root })

  let { schemaId } = netlifyGraphJson

  if (!schemaId) {
    const input = {
      appId: site.id,
      enabledServices: ['ONEGRAPH'],
      externalGraphQLSchemas: [],
      parentId: null,
      salesforceSchemaId: null,
      setAsDefaultForApp: false,
    }

    const newSchemaResult = await OneGraphClient.executeCreateGraphQLSchemaMutation(
      {
        input,
        nfToken: netlifyToken,
      },
      {
        siteId: site.id,
      },
    )

    if (newSchemaResult.errors) {
      error(`Unable to create schema: ${JSON.stringify(newSchemaResult, null, 2)} `)
    }

    const newSchema = newSchemaResult.data.oneGraph.createGraphQLSchema.graphQLSchema
    const enabledServices = newSchema.services.map((service) => ({ service: service.service, enabled: true }))

    schemaId = newSchema.id

    netlifyGraphJson = { ...netlifyGraphJson, schemaId, enabledServices }

    writeNetlifyGraphJson({ siteRoot: site.root, netlifyGraphJson })
    log(`Created new schema and updated ${chalk.magenta(NETLIFY_GRAPH_JSON_FILENAME)} `)
  }

  return schemaId
}

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

  const oneGraphSessionId = await ensureCLISession({
    metadata: {},
    netlifyToken,
    site,
    state,
  })

  await ensureSchemaForApp({ netlifyToken, site })

  const { schemaId } = readNetlifyGraphJson({ siteRoot: site.root })

  const schema = await OneGraphClient.fetchOneGraphSchemaById({ accessToken: netlifyToken, siteId: site.id, schemaId })

  const opsFileWatcher = monitorOperationFile({
    netlifyGraphConfig,
    onChange: async (filePath) => {
      log('NetlifyGraph operation file changed at', filePath, 'updating function library...')
      regenerateFunctionsFileFromOperationsFiles({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFiles(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        netlifyGraphConfig,
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: newOperationsDoc,
        siteId: site.id,
        siteRoot: site.root,
      })
    },
    onAdd: async (filePath) => {
      log('NetlifyGraph operation file created at', filePath, 'creating function library...')
      regenerateFunctionsFileFromOperationsFiles({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFiles(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        netlifyGraphConfig,
        netlifyToken,
        oneGraphSessionId,
        operationsDoc: newOperationsDoc,
        siteId: site.id,
        siteRoot: site.root,
      })
    },
  })

  const cliEventsCloseFn = monitorCLISessionEvents({
    appId: site.id,
    netlifyToken,
    netlifyGraphConfig,
    sessionId: oneGraphSessionId,
    site,
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
      error(`Netlify Graph upstream error: ${fetchEventError} `)
    },
    onClose: () => {
      log('Netlify Graph upstream session closed')
    },
  })

  return async function unregisterWatchers() {
    const watcher = await opsFileWatcher
    watcher.close()
    cliEventsCloseFn()
  }
}

/**
 * Mark a session as inactive so it doesn't show up in any UI lists, and potentially becomes available to GC later
 * @param {object} input
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.siteId A function to call to set/get the current state of the local Netlify project
 * @param {string} input.sessionId The session id to monitor CLI events for
 */
const markCliSessionInactive = async ({ netlifyToken, sessionId, siteId }) => {
  const result = await executeMarkCliSessionInactive(netlifyToken, siteId, sessionId)
  if (result.errors) {
    warn(`Unable to mark CLI session ${sessionId} inactive: ${JSON.stringify(result.errors, null, 2)} `)
  }
}

/**
 * Generate a session name that can be identified as belonging to the current checkout
 * @returns {string} The name of the session to create
 */
const generateSessionName = () => {
  const userInfo = os.userInfo({ encoding: 'utf-8' })
  const sessionName = `${userInfo.username} -${Date.now()} `
  log(`Generated Netlify Graph session name: ${sessionName} `)
  return sessionName
}

/**
 * Ensures a cli session exists for the current checkout, or errors out if it doesn't and cannot create one.
 */
const ensureCLISession = async ({ metadata, netlifyToken, site, state }) => {
  let oneGraphSessionId = loadCLISession(state)
  let parentCliSessionId = null

  // Validate that session still exists and we can access it
  try {
    if (oneGraphSessionId) {
      const sessionEvents = await OneGraphClient.fetchCliSessionEvents({
        appId: site.id,
        authToken: netlifyToken,
        sessionId: oneGraphSessionId,
      })
      if (sessionEvents.errors) {
        warn(`Unable to fetch cli session: ${JSON.stringify(sessionEvents.errors, null, 2)} `)
        log(`Creating new cli session`)
        parentCliSessionId = oneGraphSessionId
        oneGraphSessionId = null
      }
    }
  } catch (fetchSessionError) {
    warn(`Unable to fetch cli session events: ${JSON.stringify(fetchSessionError, null, 2)} `)
    oneGraphSessionId = null
  }

  await ensureSchemaForApp({ netlifyToken, site })

  if (!oneGraphSessionId) {
    // If we can't access the session in the state.json or it doesn't exist, create a new one
    const sessionName = generateSessionName()
    const detectedMetadata = detectLocalCLISessionMetadata({ siteRoot: site.root })
    const newSessionMetadata = parentCliSessionId ? { parentCliSessionId } : {}
    const sessionMetadata = {
      ...detectedMetadata,
      ...newSessionMetadata,
      ...metadata,
    }
    const oneGraphSession = await createCLISession({
      netlifyToken,
      siteId: site.id,
      sessionName,
      metadata: sessionMetadata,
    })
    state.set('oneGraphSessionId', oneGraphSession.id)
    oneGraphSessionId = state.get('oneGraphSessionId')
  }

  if (!oneGraphSessionId) {
    error('Unable to create or access Netlify Graph CLI session')
  }

  const { errors: markCLISessionActiveErrors } = await executeMarkCliSessionActiveHeartbeat(
    netlifyToken,
    site.id,
    oneGraphSessionId,
  )

  if (markCLISessionActiveErrors) {
    warn(`Unable to mark cli session active: ${JSON.stringify(markCLISessionActiveErrors, null, 2)} `)
  }

  return oneGraphSessionId
}

const OneGraphCliClient = {
  ackCLISessionEvents: OneGraphClient.ackCLISessionEvents,
  executeCreatePersistedQueryMutation: OneGraphClient.executeCreatePersistedQueryMutation,
  executeCreateApiTokenMutation: OneGraphClient.executeCreateApiTokenMutation,
  fetchCliSessionEvents: OneGraphClient.fetchCliSessionEvents,
  ensureAppForSite,
  updateCLISessionMetadata,
}

module.exports = {
  OneGraphCliClient,
  createCLISession,
  ensureCLISession,
  ensureSchemaForApp,
  extractFunctionsFromOperationDoc,
  handleCliSessionEvent,
  generateSessionName,
  loadCLISession,
  markCliSessionInactive,
  monitorCLISessionEvents,
  persistNewOperationsDocForSession,
  readNetlifyGraphJson,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
  upsertMergeCLISessionMetadata,
}
