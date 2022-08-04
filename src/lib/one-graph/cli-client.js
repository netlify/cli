// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
const crypto = require('crypto')
const { readFileSync, writeFileSync } = require('fs')
const os = require('os')
const path = require('path')

const gitRepoInfo = require('git-repo-info')
const { GraphQL, InternalConsole, OneGraphClient } = require('netlify-onegraph-internal')
const { NetlifyGraph, NetlifyGraphLockfile } = require('netlify-onegraph-internal')

// eslint-disable-next-line no-unused-vars
const { StateConfig, USER_AGENT, chalk, error, execa, log, warn, watchDebounced } = require('../../utils')

const {
  generateFunctionsFile,
  generateHandlerByOperationId,
  loadNetlifyGraphConfig,
  normalizeOperationsDoc,
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
 * @param {any} input.site The site object
 * @returns
 */
const monitorCLISessionEvents = (input) => {
  const { appId, netlifyGraphConfig, netlifyToken, onClose, onError, onEvents, site, state } = input
  const currentSessionId = input.sessionId

  const frequency = 5000
  // 30 minutes
  const defaultHeartbeatFrequency = 1_800_000
  let shouldClose = false
  let nextMarkActiveHeartbeat = defaultHeartbeatFrequency

  const markActiveHelper = async () => {
    try {
      const graphJwt = await OneGraphClient.getGraphJwtForSite({ siteId: appId, nfToken: netlifyToken })
      const fullSession = await OneGraphClient.fetchCliSession({
        jwt: graphJwt.jwt,
        appId,
        sessionId: currentSessionId,
      })
      const heartbeatIntervalms = fullSession.session.cliHeartbeatIntervalMs || defaultHeartbeatFrequency
      nextMarkActiveHeartbeat = heartbeatIntervalms
      const markCLISessionActiveResult = await OneGraphClient.executeMarkCliSessionActiveHeartbeat(
        graphJwt.jwt,
        site.id,
        currentSessionId,
      )
      if (markCLISessionActiveResult.errors && markCLISessionActiveResult.errors.length !== 0) {
        warn(`Failed to mark CLI session active: ${markCLISessionActiveResult.errors.join(', ')}`)
      }
    } catch {
      warn(`Unable to reach Netlify Graph servers in order to mark CLI session active`)
    }
    setTimeout(markActiveHelper, nextMarkActiveHeartbeat)
  }

  setTimeout(markActiveHelper, nextMarkActiveHeartbeat)

  const enabledServiceWatcher = async (jwt, { appId: siteId, sessionId }) => {
    const enabledServices = state.get('oneGraphEnabledServices') || ['onegraph']

    try {
      const enabledServicesInfo = await OneGraphClient.fetchEnabledServicesForSession(jwt, siteId, sessionId)
      if (!enabledServicesInfo) {
        warn('Unable to fetch enabled services for site for code generation')
        return
      }
      const newEnabledServices = enabledServicesInfo.map((service) => service.graphQLField)
      const enabledServicesCompareKey = enabledServices.sort().join(',')
      const newEnabledServicesCompareKey = newEnabledServices.sort().join(',')

      if (enabledServicesCompareKey !== newEnabledServicesCompareKey) {
        log(
          `${chalk.magenta(
            'Reloading',
          )} Netlify Graph schema..., ${enabledServicesCompareKey} => ${newEnabledServicesCompareKey}`,
        )
        await refetchAndGenerateFromOneGraph({ netlifyGraphConfig, state, jwt, siteId, sessionId })
        log(`${chalk.green('Reloaded')} Netlify Graph schema and regenerated functions`)
      }
    } catch {
      warn(`Unable to reach Netlify Graph servers in order to fetch enabled Graph services`)
    }
  }

  const close = () => {
    shouldClose = true
  }

  let handle

  const helper = async () => {
    try {
      if (shouldClose) {
        clearTimeout(handle)
        onClose && onClose()
      }

      const graphJwt = await OneGraphClient.getGraphJwtForSite({ siteId: appId, nfToken: netlifyToken })
      const next = await OneGraphClient.fetchCliSessionEvents({ appId, jwt: graphJwt.jwt, sessionId: currentSessionId })

      if (next && next.errors) {
        next.errors.forEach((fetchEventError) => {
          onError(fetchEventError)
        })
      }

      const events = (next && next.events) || []

      if (events.length !== 0) {
        let ackIds = []
        try {
          ackIds = await onEvents(events)
        } catch (eventHandlerError) {
          warn(`Error handling event: ${eventHandlerError}`)
        } finally {
          await OneGraphClient.ackCLISessionEvents({
            appId,
            jwt: graphJwt.jwt,
            sessionId: currentSessionId,
            eventIds: ackIds,
          })
        }
      }

      await enabledServiceWatcher(graphJwt.jwt, { appId, sessionId: currentSessionId })
    } catch {
      warn(`Unable to reach Netlify Graph servers in order to sync Graph session`)
    }

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
  if (!netlifyGraphConfig.graphQLOperationsSourceFilename) {
    error('Please configure `graphQLOperationsSourceFilename` in your `netlify.toml` [graph] section')
  }

  const filePath = path.resolve(...(netlifyGraphConfig.graphQLOperationsSourceFilename || []))
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
 * @param {string} input.jwt The Graph JWT
 * @param {string} input.sessionId The session ID for the current session
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>}
 */
const refetchAndGenerateFromOneGraph = async (input) => {
  const { jwt, logger, netlifyGraphConfig, siteId, state } = input

  await OneGraphClient.ensureAppForSite(jwt, siteId)

  const enabledServicesInfo = await OneGraphClient.fetchEnabledServicesForSession(jwt, siteId, input.sessionId)
  if (!enabledServicesInfo) {
    warn('Unable to fetch enabled services for site for code generation')
    return
  }

  const enabledServices = enabledServicesInfo
    .map((service) => service.graphQLField)
    .sort((aString, bString) => aString.localeCompare(bString))

  const schema = await OneGraphClient.fetchOneGraphSchemaForServices(siteId, enabledServices)

  if (!schema) {
    error('Unable to fetch schema from Netlify Graph')
  }

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile({
    logger,
    netlifyGraphConfig,
    schema,
    operationsDoc: currentOperationsDoc,
    functions,
    fragments,
  })
  writeGraphQLSchemaFile({ logger, netlifyGraphConfig, schema })
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
 * Lockfile Operations
 */

/**
 * Persist the Netlify Graph lockfile on disk
 * @param {object} input
 * @param {string} input.siteRoot The GraphQL schema to use when generating code
 * @param {NetlifyGraphLockfile.V0_format} input.lockfile
 */
const writeLockfile = ({ lockfile, siteRoot }) => {
  writeFileSync(path.join(siteRoot, NetlifyGraphLockfile.defaultLockFileName), JSON.stringify(lockfile, null, 2))
}

/**
 * Read the Netlify Graph lockfile from disk, if it exists
 * @param {object} input
 * @param {string} input.siteRoot The GraphQL schema to use when generating code
 * @return {NetlifyGraphLockfile.V0_format | undefined}
 */
const readLockfile = ({ siteRoot }) => {
  try {
    const buf = readFileSync(path.join(siteRoot, NetlifyGraphLockfile.defaultLockFileName))
    return JSON.parse(buf.toString('utf8'))
  } catch {}
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
 * Fetch a persisted operations doc by its id, normalize it for Netlify Graph
 * and return its contents as a string
 * @param {object} input
 * @param {string} input.siteId The site id to query against
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns {Promise<string | undefined>}
 */
const fetchGraphQLOperationsLibraryFromPersistedDoc = async (input) => {
  try {
    const { docId, netlifyToken, siteId } = input
    const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
    const persistedDoc = await OneGraphClient.fetchPersistedQuery(jwt, siteId, docId)
    if (!persistedDoc) {
      warn(`No persisted doc found for: ${docId}`)
      return
    }

    // Sorts the operations stably, prepends the @netlify directive, etc.
    const operationsDocString = normalizeOperationsDoc(persistedDoc.query)

    return operationsDocString
  } catch {
    warn(`Unable to reach Netlify Graph servers in order to update Graph operations file`)
  }
}

/**
 * Fetch a persisted operations doc by its id, write it to the system, and regenerate the library
 * @param {object} input
 * @param {string} input.operationsDocString The contents of the GraphQL operations document
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFileFromPersistedDoc = (input) => {
  const { logger, netlifyGraphConfig, operationsDocString, schema } = input

  writeGraphQLOperationsSourceFile({ logger, netlifyGraphConfig, operationsDocString })
  regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })

  const hash = quickHash(operationsDocString)

  const relevantHasLength = 10

  if (witnessedIncomingDocumentHashes.length > relevantHasLength) {
    witnessedIncomingDocumentHashes.shift()
  }

  witnessedIncomingDocumentHashes.push(hash)
}

/**
 * Fetch a persisted operations doc by its id, write it to the system, and regenerate the library
 * @param {object} input
 * @param {string} input.siteId The site id to query against
 * @param {string} input.schemaId The schema ID to query against
 * @param {string} input.siteRoot Path to the root of the project
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns {Promise<string | undefined>}
 */
const handleOperationsLibraryPersistedEvent = async (input) => {
  const { schemaId, siteRoot } = input
  const operationsFileContents = await fetchGraphQLOperationsLibraryFromPersistedDoc(input)

  if (!operationsFileContents) {
    // `fetch` already warned
    return
  }

  const lockfile = NetlifyGraphLockfile.createLockfile({ operationsFileContents, schemaId })
  writeLockfile({ siteRoot, lockfile })
  updateGraphQLOperationsFileFromPersistedDoc({ ...input, operationsDocString: operationsFileContents })
}

const handleCliSessionEvent = async ({
  event,
  netlifyGraphConfig,
  netlifyToken,
  schema,
  sessionId,
  siteId,
  siteRoot,
}) => {
  const { __typename, payload } = await event
  switch (__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent':
      await handleCliSessionEvent({
        netlifyToken,
        event: payload,
        netlifyGraphConfig,
        schema,
        sessionId,
        siteId,
        siteRoot,
      })
      break
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent': {
      if (!payload.operationId && !payload.operation.id) {
        warn(`No operation id found in payload,
  ${JSON.stringify(payload, null, 2)}`)
        return
      }
      const files = generateHandlerByOperationId({
        netlifyGraphConfig,
        schema,
        operationId: payload.operationId || payload.operation.id,
        handlerOptions: payload,
      })

      if (!files) {
        warn(`No files generated for operation id: ${payload.operationId || payload.operation.id}`)
        return
      }

      const config = loadNetlifyGraphConfig(siteRoot)
      for (const file of files) {
        const fileWrittenEvent = {
          __typename: 'OneGraphNetlifyCliSessionFileWrittenEvent',
          cliSessionId: sessionId,
          payload: {
            editor: config.editor,
            filepath: file.filePath,
            audience: 'ui',
          },
        }

        try {
          const graphJwt = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

          await OneGraphClient.executeCreateCLISessionEventMutation(
            {
              sessionId,
              payload: fileWrittenEvent,
            },
            { accessToken: graphJwt.jwt },
          )
        } catch {
          warn(`Unable to reach Netlify Graph servers in order to notify handler files written to disk`)
        }
      }
      break
    }
    case 'OneGraphNetlifyCliSessionOpenFileEvent': {
      if (!payload.filePath) {
        warn(`No filePath found in payload, ${JSON.stringify(payload, null, 2)}`)
        return
      }
      const config = loadNetlifyGraphConfig(siteRoot)
      if (config.editor) {
        log(`Opening ${config.editor} for ${payload.filePath}`)
        execa(config.editor, [payload.filePath], {
          preferLocal: true,
          // windowsHide needs to be false for child process to terminate properly on Windows
          windowsHide: false,
        })
      } else {
        warn('No editor found in config')
      }
      break
    }
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent':
      await handleOperationsLibraryPersistedEvent({
        netlifyToken,
        docId: payload.docId,
        schemaId: payload.schemaId,
        netlifyGraphConfig,
        schema,
        siteId,
        siteRoot,
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

/**
 *
 * @param {object} input
 * @param {string} input.jwt The GraphJWT string
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {object} input.siteId The site object that contains the root file path for the site
 */
const getCLISession = async ({ jwt, oneGraphSessionId, siteId }) => {
  const input = {
    appId: siteId,
    sessionId: oneGraphSessionId,
    jwt,
    desiredEventCount: 1,
  }
  return await OneGraphClient.fetchCliSession(input)
}

/**
 *
 * @param {object} input
 * @param {string} input.jwt The GraphJWT string
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteId The site object that contains the root file path for the site
 */
const getCLISessionMetadata = async ({ jwt, oneGraphSessionId, siteId }) => {
  const { errors, session } = await getCLISession({ jwt, oneGraphSessionId, siteId })
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

  const config = loadNetlifyGraphConfig(siteRoot)

  const { editor } = config

  const detectedMetadata = {
    gitBranch: branch,
    hostname,
    username,
    siteRoot,
    cliVersion,
    editor,
  }

  return detectedMetadata
}

/**
 * Fetch the existing cli session metadata if it exists, and mutate it remotely with the passed in metadata
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.jwt The Graph JWT string
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteId The site object that contains the root file path for the site
 * @param {string} input.siteRoot The root file path for the site
 * @param {object} input.newMetadata The metadata to merge into (with priority) the existing metadata
 * @returns {Promise<object>}
 */
const upsertMergeCLISessionMetadata = async ({ jwt, newMetadata, oneGraphSessionId, siteId, siteRoot }) => {
  const { errors, metadata } = await getCLISessionMetadata({ jwt, oneGraphSessionId, siteId })
  if (errors) {
    warn(`Error fetching cli session metadata: ${JSON.stringify(errors, null, 2)}`)
  }

  const detectedMetadata = detectLocalCLISessionMetadata({ siteRoot })

  // @ts-ignore
  const finalMetadata = { ...metadata, ...detectedMetadata, ...newMetadata }

  return OneGraphClient.updateCLISessionMetadata(jwt, siteId, oneGraphSessionId, finalMetadata)
}

const persistNewOperationsDocForSession = async ({
  netlifyGraphConfig,
  netlifyToken,
  oneGraphSessionId,
  operationsDoc,
  siteId,
  siteRoot,
}) => {
  try {
    GraphQL.parse(operationsDoc)
  } catch (parseError) {
    // TODO: We should send a message to the web UI that the current GraphQL operations file can't be sync because it's invalid
    warn(
      `Unable to sync Graph operations file. Please ensure that your GraphQL operations file is valid GraphQL. Found error: ${JSON.stringify(
        parseError,
        null,
        2,
      )}`,
    )
    return
  }

  const lockfile = readLockfile({ siteRoot })

  if (!lockfile) {
    warn(
      `can't find a lockfile for the project while running trying to persist operations for session. To pull a remote schema (and create a lockfile), run ${chalk.yellow(
        'netlify graph:pull',
      )} `,
    )
  }

  // NOTE(anmonteiro): We still persist a new operations document because we
  // might be checking out someone else's branch whose session we don't have
  // access to.

  const { branch } = gitRepoInfo()
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
  const persistedResult = await OneGraphClient.executeCreatePersistedQueryMutation(
    {
      appId: siteId,
      description: 'Temporary snapshot of local queries',
      query: operationsDoc,
      tags: ['netlify-cli', `session:${oneGraphSessionId}`, `git-branch:${branch}`, `local-change`],
    },
    {
      accessToken: jwt,
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

  const newMetadata = { docId: persistedDoc.id }
  const result = await upsertMergeCLISessionMetadata({
    netlifyGraphConfig,
    jwt,
    siteId,
    oneGraphSessionId,
    newMetadata,
    siteRoot,
  })

  if (result.errors) {
    warn(`Unable to update session metadata with updated operations doc ${JSON.stringify(result.errors, null, 2)}`)
  } else if (lockfile != null) {
    // Now that we've persisted the document, lock it in the lockfile
    const currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)

    const newLockfile = NetlifyGraphLockfile.createLockfile({
      schemaId: lockfile.locked.schemaId,
      operationsFileContents: currentOperationsDoc,
    })
    writeLockfile({ siteRoot, lockfile: newLockfile })
  }
}

const createCLISession = async ({ metadata, netlifyToken, sessionName, siteId }) => {
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
  const result = OneGraphClient.createCLISession(jwt, siteId, sessionName, metadata)
  return result
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
 * @param {string | undefined} input.oneGraphSessionId The session ID to use for this CLI session (default: read from state)
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
 * @param {any} input.site The site object
 */
const startOneGraphCLISession = async (input) => {
  const { netlifyGraphConfig, netlifyToken, site, state } = input
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId: site.id, nfToken: netlifyToken })
  OneGraphClient.ensureAppForSite(jwt, site.id)

  const oneGraphSessionId = await ensureCLISession({
    metadata: {},
    netlifyToken,
    site,
    state,
    oneGraphSessionId: input.oneGraphSessionId,
    netlifyGraphConfig,
  })

  const enabledServices = []
  const schema = await OneGraphClient.fetchOneGraphSchemaForServices(site.id, enabledServices)

  const opsFileWatcher = monitorOperationFile({
    netlifyGraphConfig,
    onChange: async (filePath) => {
      log('NetlifyGraph operation file changed at', filePath, 'updating function library...')
      regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
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
      regenerateFunctionsFileFromOperationsFile({ netlifyGraphConfig, schema })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
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
    state,
    onClose: () => {
      log('CLI session closed, stopping monitoring...')
    },
    onEvents: async (events) => {
      const ackEventIds = []

      for (const event of events) {
        const audience = OneGraphClient.eventAudience(event)
        if (audience === 'cli') {
          const eventName = OneGraphClient.friendlyEventName(event)
          log(`${chalk.magenta('Handling')} Netlify Graph: ${eventName}...`)
          await handleCliSessionEvent({
            netlifyToken,
            event,
            netlifyGraphConfig,
            schema,
            sessionId: oneGraphSessionId,
            siteId: site.id,
            siteRoot: site.root,
          })
          log(`${chalk.green('Finished handling')} Netlify Graph: ${eventName}...`)
          ackEventIds.push(event.id)
        }
      }

      return ackEventIds
    },
    onError: (fetchEventError) => {
      error(`Netlify Graph upstream error: ${fetchEventError}`)
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
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
  const result = await OneGraphClient.executeMarkCliSessionInactive(jwt, siteId, sessionId)
  if (result.errors) {
    warn(`Unable to mark CLI session ${sessionId} inactive: ${JSON.stringify(result.errors, null, 2)}`)
  }
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

/**
 * Mark a session as inactive so it doesn't show up in any UI lists, and potentially becomes available to GC later
 * @param {object} input
 * @param {{metadata: {schemaId:string}; id: string; appId: string; name?: string}} input.session The current session
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {NetlifyGraphLockfile.V0_format | undefined} input.lockfile A function to call to set/get the current state of the local Netlify project
 */
const idempotentlyUpdateSessionSchemaIdFromLockfile = async (input) => {
  const { lockfile, netlifyToken, session } = input
  const sessionSchemaId = session.metadata && session.metadata.schemaId
  const lockfileSchemaId = lockfile && lockfile.locked.schemaId

  if (lockfileSchemaId != null && sessionSchemaId !== lockfileSchemaId) {
    // Local schema always wins, update the session metadata to reflect that
    const siteId = session.appId
    const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

    log(`Found new lockfile, overwriting session ${session.name || session.id}`)
    return OneGraphClient.updateCLISessionMetadata(jwt, siteId, session.id, {
      ...session.metadata,
      schemaId: lockfileSchemaId,
    })
  }
}

/**
 * Ensures a cli session exists for the current checkout, or errors out if it doesn't and cannot create one.
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {object} input.metadata
 * @param {string} input.netlifyToken
 * @param {StateConfig} input.state
 * @param {string} [input.oneGraphSessionId]
 * @param {any} input.site The site object
 */
const ensureCLISession = async (input) => {
  const { metadata, netlifyGraphConfig, netlifyToken, site, state } = input
  let oneGraphSessionId = input.oneGraphSessionId ? input.oneGraphSessionId : loadCLISession(state)
  let parentCliSessionId = null
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId: site.id, nfToken: netlifyToken })

  const lockfile = readLockfile({ siteRoot: site.root })

  // Validate that session still exists and we can access it
  try {
    if (oneGraphSessionId) {
      const { errors, session } = await OneGraphClient.fetchCliSession({
        appId: site.id,
        jwt,
        sessionId: oneGraphSessionId,
        desiredEventCount: 0,
      })
      if (errors) {
        warn(`Unable to fetch cli session: ${JSON.stringify(errors, null, 2)}`)
        log(`Creating new cli session`)
        parentCliSessionId = oneGraphSessionId
        oneGraphSessionId = null
      }

      // During the transition to lockfiles, write a lockfile if one isn't
      // found. Later, only handling a 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent'
      // will create or update the lockfile
      // TODO(anmonteiro): remove this in the future?
      if (lockfile == null && session.metadata.schemaId) {
        const currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
        log(`Generating Netlify Graph lockfile at ${NetlifyGraphLockfile.defaultLockFileName}`)

        const newLockfile = NetlifyGraphLockfile.createLockfile({
          schemaId: session.metadata.schemaId,
          operationsFileContents: currentOperationsDoc,
        })
        writeLockfile({ siteRoot: site.root, lockfile: newLockfile })
      }

      await idempotentlyUpdateSessionSchemaIdFromLockfile({ session, lockfile, netlifyToken })
    }
  } catch (fetchSessionError) {
    warn(`Unable to fetch cli session events: ${JSON.stringify(fetchSessionError, null, 2)}`)
    oneGraphSessionId = null
  }

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

    if (lockfile != null) {
      log(`Creating new session "${sessionName}" from lockfile`)
      sessionMetadata.schemaId = lockfile.locked.schemaId
    }

    const oneGraphSession = await createCLISession({
      netlifyToken,
      siteId: site.id,
      sessionName,
      metadata: sessionMetadata,
    })

    oneGraphSessionId = oneGraphSession.id
  }

  if (!oneGraphSessionId) {
    error('Unable to create or access Netlify Graph CLI session')
  }

  state.set('oneGraphSessionId', oneGraphSessionId)
  const { errors: markCLISessionActiveErrors } = await OneGraphClient.executeMarkCliSessionActiveHeartbeat(
    jwt,
    site.id,
    oneGraphSessionId,
  )

  if (markCLISessionActiveErrors) {
    warn(`Unable to mark cli session active: ${JSON.stringify(markCLISessionActiveErrors, null, 2)}`)
  }

  return oneGraphSessionId
}

const OneGraphCliClient = {
  ackCLISessionEvents: OneGraphClient.ackCLISessionEvents,
  executeCreatePersistedQueryMutation: OneGraphClient.executeCreatePersistedQueryMutation,
  executeCreateApiTokenMutation: OneGraphClient.executeCreateApiTokenMutation,
  fetchCliSessionEvents: OneGraphClient.fetchCliSessionEvents,
  ensureAppForSite: OneGraphClient.ensureAppForSite,
  updateCLISessionMetadata: OneGraphClient.updateCLISessionMetadata,
  getGraphJwtForSite: OneGraphClient.getGraphJwtForSite,
}

module.exports = {
  OneGraphCliClient,
  createCLISession,
  ensureCLISession,
  extractFunctionsFromOperationDoc,
  handleCliSessionEvent,
  generateSessionName,
  loadCLISession,
  markCliSessionInactive,
  monitorCLISessionEvents,
  persistNewOperationsDocForSession,
  refetchAndGenerateFromOneGraph,
  startOneGraphCLISession,
  upsertMergeCLISessionMetadata,
  readLockfile,
}
