// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable fp/no-loops */
/* eslint-disable no-underscore-dangle */
import crypto from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import process from 'process'

import { listFrameworks } from '@netlify/framework-info'
import gitRepoInfo from 'git-repo-info'
import WSL from 'is-wsl'
import { GraphQL, InternalConsole, NetlifyGraph, NetlifyGraphLockfile, OneGraphClient } from 'netlify-onegraph-internal'

import { chalk, error, log, warn, watchDebounced } from '../../utils/command-helpers.mjs'
import execa from '../../utils/execa.mjs'
import getPackageJson from '../../utils/get-package-json.mjs'

import {
  generateFunctionsFile,
  generateHandlerByOperationId,
  getCodegenFunctionById,
  getCodegenModule,
  normalizeOperationsDoc,
  readGraphQLOperationsSourceFile,
  setNetlifyTomlCodeGeneratorModule,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
} from './cli-netlify-graph.mjs'

const { parse } = GraphQL
const { defaultExampleOperationsDoc, extractFunctionsFromOperationDoc } = NetlifyGraph

const { version } = await getPackageJson()

const internalConsole = {
  log,
  warn,
  error,
  debug: console.debug,
}

/** @type {string | null} */
// eslint-disable-next-line import/no-mutable-exports
let currentPersistedDocId = null

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
 * @param {object} input.config The parsed netlify.toml file
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {function} input.onClose A function to call when the polling loop is closed
 * @param {function} input.onError A function to call when an error occurs
 * @param {function} input.onEvents A function to call when CLI events are received and need to be processed
 * @param {function} input.onSchemaIdChange A function to call when the CLI schemaId has changed
 * @param {string} input.sessionId The session id to monitor CLI events for
 * @param {import('../../utils/state-config.mjs').default} input.state A function to call to set/get the current state of the local Netlify project
 * @param {any} input.site The site object
 * @returns
 */
export const monitorCLISessionEvents = (input) => {
  const { appId, config, netlifyGraphConfig, netlifyToken, onClose, onError, onEvents, site, state } = input
  const currentSessionId = input.sessionId
  // TODO (sg): Track changing schemaId for a session

  const frequency = 5000
  // 30 minutes
  const defaultHeartbeatFrequency = 30_000
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
      const graphQLSchemaInfo = await OneGraphClient.fetchGraphQLSchemaForSession(jwt, siteId, input.sessionId)
      if (!graphQLSchemaInfo) {
        warn('Unable to fetch enabled services for site for code generation')
        return
      }
      const newEnabledServices = graphQLSchemaInfo.services.map((service) => service.graphQLField)
      const enabledServicesCompareKey = enabledServices.sort().join(',')
      const newEnabledServicesCompareKey = newEnabledServices.sort().join(',')

      if (enabledServicesCompareKey !== newEnabledServicesCompareKey) {
        log(
          `${chalk.magenta(
            'Reloading',
          )} Netlify Graph schema..., ${enabledServicesCompareKey} => ${newEnabledServicesCompareKey}`,
        )

        const schemaId = graphQLSchemaInfo.id

        if (!schemaId) {
          warn(`Unable to read schemaId from Netlify Graph session, not regenerating code`)
          return
        }

        mergeLockfile({ siteRoot: site.root, schemaId })

        await refetchAndGenerateFromOneGraph({ config, netlifyGraphConfig, state, jwt, schemaId, siteId, sessionId })
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
        return
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
 * @param {import('../../utils/state-config.mjs').default} input.state A function to call to set/get the current state of the local Netlify project
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<Record<string, unknown> | undefined>}
 */
const fetchCliSessionSchema = async (input) => {
  const { jwt, siteId } = input

  await OneGraphClient.ensureAppForSite(jwt, siteId)

  const schemaInfo = await OneGraphClient.fetchNetlifySessionSchemaQuery(
    { sessionId: input.sessionId },
    {
      accessToken: jwt,
      siteId,
    },
  )

  if (!schemaInfo) {
    warn('Unable to fetch schema for session')
    return
  }

  try {
    const schemaMetadata = schemaInfo.data.oneGraph.netlifyCliSession.graphQLSchema
    return schemaMetadata
  } catch {}
}

/**
 * Fetch the schema for a site, and regenerate all of the downstream files
 * @param {object} input
 * @param {string} input.siteId The id of the site to query against
 * @param {string} input.jwt The Graph JWT
 * @param {object} input.config The parsed netlify.toml file
 * @param {string} input.sessionId The session ID for the current session
 * @param {string} input.schemaId The schemaId for the current session
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {import('../../utils/state-config.mjs').default} input.state A function to call to set/get the current state of the local Netlify project
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>}
 */
export const refetchAndGenerateFromOneGraph = async (input) => {
  const { config, jwt, logger, netlifyGraphConfig, schemaId, siteId, state } = input

  await OneGraphClient.ensureAppForSite(jwt, siteId)

  const graphQLSchemaInfo = await OneGraphClient.fetchGraphQLSchemaForSession(jwt, siteId, input.sessionId)
  if (!graphQLSchemaInfo) {
    warn('Unable to fetch schema info for site for code generation')
    return
  }

  const enabledServices = graphQLSchemaInfo.services
    .map((service) => service.graphQLField)
    .sort((aString, bString) => aString.localeCompare(bString))

  const schema = await OneGraphClient.fetchOneGraphSchemaById({
    siteId,
    schemaId: graphQLSchemaInfo.id,
    accessToken: jwt,
  })

  if (!schema) {
    error('Unable to fetch schema from Netlify Graph')
  }

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

  if (!schema) {
    warn('Unable to parse schema, please run graph:pull to update')
    return
  }

  await generateFunctionsFile({
    config,
    logger,
    netlifyGraphConfig,
    schema,
    operationsDoc: currentOperationsDoc,
    functions,
    fragments,
    schemaId,
  })
  writeGraphQLSchemaFile({ logger, netlifyGraphConfig, schema })
  state.set('oneGraphEnabledServices', enabledServices)
}

/**
 * Regenerate the function library based on the current operations document on disk
 * @param {object} input
 * @param {object} input.config The parsed netlify.toml file
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {string} input.schemaId The GraphQL schemaId to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const regenerateFunctionsFileFromOperationsFile = (input) => {
  const { config, netlifyGraphConfig, schema, schemaId } = input

  const appOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)

  const hash = quickHash(appOperationsDoc)

  if (witnessedIncomingDocumentHashes.includes(hash)) {
    // We've already seen this document, so don't regenerate
    return
  }

  const parsedDoc = parse(appOperationsDoc, {
    noLocation: true,
  })
  const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)
  generateFunctionsFile({
    config,
    netlifyGraphConfig,
    schema,
    operationsDoc: appOperationsDoc,
    functions,
    fragments,
    schemaId,
  })
}

/**
 * Lockfile Operations
 */

/**
 * Read the Netlify Graph lockfile from disk, if it exists
 * @param {object} input
 * @param {string} input.siteRoot The GraphQL schema to use when generating code
 * @return {NetlifyGraphLockfile.V0_format | undefined}
 */
export const readLockfile = ({ siteRoot }) => {
  try {
    const buf = readFileSync(path.join(siteRoot, NetlifyGraphLockfile.defaultLockFileName))
    return JSON.parse(buf.toString('utf8'))
  } catch {}
}

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
 * Persist the Netlify Graph lockfile on disk
 * @param {object} input
 * @param {string} input.siteRoot The GraphQL schema to use when generating code
 * @param {string=} input.schemaId
 * @param {string=} input.operationsHash
 */
const mergeLockfile = ({ operationsHash, schemaId, siteRoot }) => {
  const lockfile = readLockfile({ siteRoot })
  if (lockfile) {
    /** @type {NetlifyGraphLockfile.V0_format} */
    const newLockfile = {
      ...lockfile,
      locked: {
        ...lockfile.locked,
      },
    }

    if (operationsHash) {
      newLockfile.locked.operationsHash = operationsHash
    }

    if (schemaId) {
      newLockfile.locked.schemaId = schemaId
    }

    writeFileSync(path.join(siteRoot, NetlifyGraphLockfile.defaultLockFileName), JSON.stringify(newLockfile, null, 2))
  }
}

/**
 * Read the Netlify Graph schemaId from the lockfile on disk, if it exists
 * @param {object} input
 * @param {string} input.siteRoot The GraphQL schema to use when generating code
 * @return {string | undefined}
 */
export const readSchemaIdFromLockfile = ({ siteRoot }) => {
  try {
    const lockfile = readLockfile({ siteRoot })
    return lockfile && lockfile.locked.schemaId
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
 * @param {object} input.config The parsed netlify.toml file
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {string} input.schemaId The GraphQL schemaId to use when generating code
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
    const operationsDocString = normalizeOperationsDoc(GraphQL, persistedDoc.query)

    currentPersistedDocId = docId

    return operationsDocString
  } catch {
    warn(`Unable to reach Netlify Graph servers in order to update Graph operations file`)
  }
}

/**
 * Fetch a persisted operations doc by its id, write it to the system, and regenerate the library
 * @param {object} input
 * @param {object} input.config The parsed netlify.toml config file
 * @param {string} input.operationsDocString The contents of the GraphQL operations document
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {string} input.schemaId The GraphQL schemaId to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @returns
 */
const updateGraphQLOperationsFileFromPersistedDoc = (input) => {
  const { config, logger, netlifyGraphConfig, operationsDocString, schema, schemaId } = input

  writeGraphQLOperationsSourceFile({ logger, netlifyGraphConfig, operationsDocString })
  regenerateFunctionsFileFromOperationsFile({ config, netlifyGraphConfig, schema, schemaId })

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
 * @param {object} input.config The parsed netlify.toml config file
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

/**
 *
 * @param {object} input
 * @param {any} input.site The site object
 * @param {import('netlify-onegraph-internal').CliEventHelper.CliEvent} input.event
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating code
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {object} input.config The parsed netlify.toml config file
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string} input.schemaId The schemaId for the current session
 * @param {string} input.sessionId The session ID to use for this CLI session (default: read from state)
 * @param {string} input.siteId The site id to query against
 * @param {string} input.siteRoot Path to the root of the project
 * @returns {Promise<void>}
 */
export const handleCliSessionEvent = async ({
  config,
  docId,
  event,
  netlifyGraphConfig,
  netlifyToken,
  schema,
  schemaId,
  sessionId,
  site,
  siteId,
  siteRoot,
}) => {
  switch (event.__typename) {
    case 'OneGraphNetlifyCliSessionTestEvent': {
      const { payload } = event

      await handleCliSessionEvent({
        config,
        docId,
        netlifyToken,
        // @ts-ignore
        event: payload,
        netlifyGraphConfig,
        schema,
        schemaId,
        sessionId,
        siteId,
        siteRoot,
        site,
      })

      break
    }
    case 'OneGraphNetlifyCliSessionGenerateHandlerEvent': {
      const { payload } = event

      if (!payload.operationId) {
        warn(`No operation id found in payload,
${JSON.stringify(payload, null, 2)}`)
        return
      }

      const codegenModule = await getCodegenModule({ config })
      if (!codegenModule) {
        error(
          `No Netlify Graph codegen module specified in netlify.toml under the [graph] header. Please specify 'codeGenerator' field and try again.`,
        )
        return
      }

      const codeGenerator = await getCodegenFunctionById({ config, id: payload.codegenId })
      if (!codeGenerator) {
        warn(
          `Unable to find Netlify Graph code generator with id "${payload.codegenId}" from ${JSON.stringify(
            payload,
            null,
            2,
          )}`,
        )
        return
      }

      const files = await generateHandlerByOperationId({
        netlifyGraphConfig,
        schema,
        operationId: payload.operationId,
        handlerOptions: payload,
        generate: codeGenerator.generateHandler,
      })

      if (!files) {
        warn(`No files generated for operation id: ${payload.operationId}`)
        return
      }

      const editor = process.env.EDITOR || null

      /** @type {import('netlify-onegraph-internal').CliEventHelper.OneGraphNetlifyCliSessionFilesWrittenEvent} */
      const filesWrittenEvent = {
        id: crypto.randomUUID(),
        createdAt: new Date().toString(),
        __typename: 'OneGraphNetlifyCliSessionFilesWrittenEvent',
        sessionId,
        payload: {
          editor,
          // @ts-expect-error
          files: files.map((file) => ({
            name: file.name,
            filePath: file.filePath,
          })),
        },
        audience: 'UI',
      }

      try {
        const graphJwt = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

        await OneGraphClient.executeCreateCLISessionEventMutation(
          {
            sessionId,
            payload: filesWrittenEvent,
          },
          { accessToken: graphJwt.jwt },
        )
      } catch {
        warn(`Unable to reach Netlify Graph servers in order to notify handler files written to disk`)
      }

      break
    }
    case 'OneGraphNetlifyCliSessionOpenFileEvent': {
      if (!event.payload.filePath) {
        warn(`No filePath found in payload, ${JSON.stringify(event.payload, null, 2)}`)
        return
      }

      const editor = process.env.EDITOR || null

      if (editor) {
        log(`Opening ${editor} for ${event.payload.filePath}`)
        execa(editor, [event.payload.filePath], {
          preferLocal: true,
          // windowsHide needs to be false for child process to terminate properly on Windows
          windowsHide: false,
        })
      } else {
        warn('No $EDITOR set in env vars')
      }
      break
    }
    case 'OneGraphNetlifyCliSessionSetGraphCodegenModuleEvent': {
      setNetlifyTomlCodeGeneratorModule({ codegenModuleImportPath: event.payload.codegenModuleImportPath, siteRoot })
      break
    }
    case 'OneGraphNetlifyCliSessionMetadataRequestEvent': {
      const graphJwt = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })

      const { minimumCliVersionExpected } = event.payload

      const cliIsOutOfDateForUI =
        version.localeCompare(minimumCliVersionExpected, undefined, { numeric: true, sensitivity: 'base' }) === -1

      if (cliIsOutOfDateForUI) {
        warn(
          `The Netlify Graph UI expects the netlify-cli to be at least at version "${minimumCliVersionExpected}", but you're running ${version}. You may need to upgrade for a stable experience.`,
        )
      }

      const input = { config, docId, jwt: graphJwt.jwt, schemaId, sessionId, siteRoot }
      await publishCliSessionMetadataPublishEvent(input)
      break
    }
    case 'OneGraphNetlifyCliSessionPersistedLibraryUpdatedEvent': {
      const { payload } = event

      if (!payload.schemaId || !payload.docId) {
        warn(`Malformed library update event, missing schemaId or docId in payload:
  ${JSON.stringify(event, null, 2)}`)
        break
      }

      await handleOperationsLibraryPersistedEvent({
        config,
        netlifyToken,
        docId: payload.docId,
        schemaId: payload.schemaId,
        netlifyGraphConfig,
        schema,
        siteId,
        siteRoot,
      })

      break
    }
    default: {
      warn(
        `Unrecognized event received, you may need to upgrade your CLI version: ${event.__typename}: ${JSON.stringify(
          event,
          null,
          2,
        )}`,
      )
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
  const result = await getCLISession({ jwt, oneGraphSessionId, siteId })
  if (!result) {
    warn(`Unable to fetch CLI session metadata`)
  }
  const { errors, session } = result
  return { metadata: session && session.metadata, errors }
}

/**
 * Look at the current project, filesystem, etc. and determine relevant metadata for a cli session
 * @param {object} input
 * @param {string} input.siteRoot The root file path for the site
 * @returns {Promise<import('netlify-onegraph-internal').CliEventHelper.DetectedLocalCLISessionMetadata>} Any locally detected facts that are relevant to include in the cli session metadata
 */
const detectLocalCLISessionMetadata = async ({ siteRoot }) => {
  /** @type {string | null} */
  let framework = null

  try {
    const frameworks = await listFrameworks({ projectDir: siteRoot })
    framework = frameworks[0].id || null
  } catch {}

  const { branch } = gitRepoInfo()
  const hostname = os.hostname()
  const userInfo = os.userInfo({ encoding: 'utf-8' })
  const { username } = userInfo
  const cliVersion = version

  const platform = WSL ? 'wsl' : os.platform()
  const arch = os.arch() === 'ia32' ? 'x86' : os.arch()

  const editor = process.env.EDITOR || null

  const detectedMetadata = {
    gitBranch: branch,
    hostname,
    username,
    siteRoot,
    cliVersion,
    editor,
    platform,
    arch,
    nodeVersion: process.version,
    framework,
    codegen: null,
  }

  return detectedMetadata
}

/**
 *
 * @param {object} input
 * @param {string} input.jwt The GraphJWT string
 * @param {string} input.sessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteRoot Path to the root of the project
 * @param {object} input.config The parsed netlify.toml config file
 * @param {string} input.docId The GraphQL operations document id to fetch
 * @param {string} input.schemaId The GraphQL schemaId to use when generating code
 */
const publishCliSessionMetadataPublishEvent = async ({ config, docId, jwt, schemaId, sessionId, siteRoot }) => {
  const detectedMetadata = await detectLocalCLISessionMetadata({ siteRoot })

  /** @type {import('netlify-onegraph-internal').CodegenHelpers.CodegenModuleMeta | null} */
  let codegen = null

  const codegenModule = await getCodegenModule({ config })

  if (codegenModule) {
    codegen = {
      id: codegenModule.id,
      version: codegenModule.id,
      generators: codegenModule.generators.map((generator) => ({
        id: generator.id,
        name: generator.name,
        options: generator.generateHandlerOptions || null,
        supportedDefinitionTypes: generator.supportedDefinitionTypes,
        version: generator.version,
      })),
    }
  }

  /** @type {import('netlify-onegraph-internal').CliEventHelper.OneGraphNetlifyCliSessionMetadataPublishEvent} */
  const event = {
    __typename: 'OneGraphNetlifyCliSessionMetadataPublishEvent',
    audience: 'UI',
    createdAt: new Date().toString(),
    id: crypto.randomUUID(),
    sessionId,
    payload: {
      cliVersion: detectedMetadata.cliVersion,
      editor: detectedMetadata.editor,
      siteRoot: detectedMetadata.siteRoot,
      siteRootFriendly: detectedMetadata.siteRoot,
      persistedDocId: docId,
      schemaId,
      codegenModule: codegen,
      arch: detectedMetadata.arch,
      nodeVersion: detectedMetadata.nodeVersion,
      platform: detectedMetadata.platform,
      framework: detectedMetadata.framework,
    },
  }

  try {
    await OneGraphClient.executeCreateCLISessionEventMutation(
      {
        sessionId,
        payload: event,
      },
      { accessToken: jwt },
    )
  } catch {
    warn(`Unable to reach Netlify Graph servers in order to publish CLI session data for the Graph UI`)
  }
}

/**
 * Fetch the existing cli session metadata if it exists, and mutate it remotely with the passed in metadata
 * @param {object} input
 * @param {object} input.config The parsed netlify.toml file
 * @param {string} input.jwt The Graph JWT string
 * @param {string} input.oneGraphSessionId The id of the cli session to fetch the current metadata for
 * @param {string} input.siteId The site object that contains the root file path for the site
 * @param {string} input.siteRoot The root file path for the site
 * @param {object} input.newMetadata The metadata to merge into (with priority) the existing metadata
 * @returns {Promise<object>}
 */
export const upsertMergeCLISessionMetadata = async ({ jwt, newMetadata, oneGraphSessionId, siteId, siteRoot }) => {
  const { errors, metadata } = await getCLISessionMetadata({ jwt, oneGraphSessionId, siteId })
  if (errors) {
    warn(`Error fetching cli session metadata: ${JSON.stringify(errors, null, 2)}`)
  }

  const detectedMetadata = await detectLocalCLISessionMetadata({ siteRoot })

  // @ts-ignore
  const finalMetadata = { ...metadata, ...detectedMetadata, ...newMetadata }

  const result = OneGraphClient.updateCLISessionMetadata(jwt, siteId, oneGraphSessionId, finalMetadata)

  return result
}

export const persistNewOperationsDocForSession = async ({
  config,
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

  currentPersistedDocId = persistedDoc.id

  const newMetadata = { docId: persistedDoc.id }
  const result = await upsertMergeCLISessionMetadata({
    config,
    jwt,
    siteId,
    oneGraphSessionId,
    newMetadata,
    siteRoot,
  })

  if (!result || result.errors) {
    warn(
      `Unable to update session metadata with updated operations docId="${persistedDoc.id}": ${JSON.stringify(
        result && result.errors,
        null,
        2,
      )}`,
    )
  } else if (lockfile != null) {
    // Now that we've persisted the document, lock it in the lockfile
    const currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)

    /** @type {NetlifyGraphLockfile.V0_format} */
    const newLockfile = NetlifyGraphLockfile.createLockfile({
      schemaId: lockfile.locked.schemaId,
      operationsFileContents: currentOperationsDoc,
    })
    writeLockfile({ siteRoot, lockfile: newLockfile })
  }
}

export const createCLISession = async ({ metadata, netlifyToken, sessionName, siteId }) => {
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
  const result = OneGraphClient.createCLISession(jwt, siteId, sessionName, metadata)
  return result
}

/**
 * Load the CLI session id from the local state
 * @param {import('../../utils/state-config.mjs').default} state
 * @returns
 */
export const loadCLISession = (state) => state.get('oneGraphSessionId')

/**
 * Idemponentially save the CLI session id to the local state and start monitoring for CLI events, upstream schema changes, and local operation file changes
 * @param {object} input
 * @param {object} input.config
 * @param {string} input.netlifyToken The (typically netlify) access token that is used for authentication, if any
 * @param {string | undefined} input.oneGraphSessionId The session ID to use for this CLI session (default: read from state)
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {import('../../utils/state-config.mjs').default} input.state A function to call to set/get the current state of the local Netlify project
 * @param {any} input.site The site object
 */
export const startOneGraphCLISession = async (input) => {
  const { config, netlifyGraphConfig, netlifyToken, site, state } = input
  const getJwt = async () => {
    const accessToken = await OneGraphClient.getGraphJwtForSite({ siteId: site.id, nfToken: netlifyToken })
    return accessToken.jwt
  }

  OneGraphClient.ensureAppForSite(await getJwt(), site.id)

  const oneGraphSessionId = await ensureCLISession({
    config,
    netlifyGraphConfig,
    metadata: {},
    netlifyToken,
    site,
    state,
    oneGraphSessionId: input.oneGraphSessionId,
  })

  const syncUIHelper = async () => {
    const schemaId = readSchemaIdFromLockfile({ siteRoot: site.root })

    if (!schemaId) {
      warn('Unable to load schemaId from Netlify Graph lockfile, run graph:pull to update')
      return
    }

    if (!currentPersistedDocId) {
      warn('Unable to read current persisted Graph library doc id')
      return
    }

    const syncSessionMetadataInput = {
      config,
      docId: currentPersistedDocId,
      jwt: await getJwt(),
      schemaId,
      sessionId: oneGraphSessionId,
      siteRoot: site.root,
    }
    await publishCliSessionMetadataPublishEvent(syncSessionMetadataInput)
  }

  await syncUIHelper()

  const enabledServices = []
  const schema = await OneGraphClient.fetchOneGraphSchemaForServices(site.id, enabledServices)

  const opsFileWatcher = monitorOperationFile({
    netlifyGraphConfig,
    onChange: async (filePath) => {
      log('NetlifyGraph operation file changed at', filePath, 'updating function library...')
      if (!schema) {
        warn('Unable to load schema, run graph:pull to update')
        return
      }

      const schemaId = readSchemaIdFromLockfile({ siteRoot: site.root })

      if (!schemaId) {
        warn('Unable to load schemaId from Netlify Graph lockfile, run graph:pull to update')
        return
      }

      regenerateFunctionsFileFromOperationsFile({ config, netlifyGraphConfig, schema, schemaId })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        config,
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
      if (!schema) {
        warn('Unable to load schema, run graph:pull to update')
        return
      }

      const schemaId = readSchemaIdFromLockfile({ siteRoot: site.root })

      if (!schemaId) {
        warn('Unable to load schemaId from Netlify Graph lockfile, run graph:pull to update')
        return
      }

      regenerateFunctionsFileFromOperationsFile({ config, netlifyGraphConfig, schema, schemaId })
      const newOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
      await persistNewOperationsDocForSession({
        config,
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
    config,
    appId: site.id,
    netlifyToken,
    netlifyGraphConfig,
    sessionId: oneGraphSessionId,
    site,
    state,
    onClose: () => {
      log('CLI session closed, stopping monitor...')
    },
    onSchemaIdChange: (newSchemaId) => {
      log('Netlify Graph schemaId changed:', newSchemaId)
    },
    onEvents: async (events) => {
      const ackEventIds = []

      for (const event of events) {
        try {
          const audience = event.audience || OneGraphClient.eventAudience(event)
          if (audience === 'CLI') {
            ackEventIds.push(event.id)
            const eventName = OneGraphClient.friendlyEventName(event)
            log(`${chalk.magenta('Handling')} Netlify Graph: ${eventName}...`)
            const schemaId = readSchemaIdFromLockfile({ siteRoot: site.root })

            if (!schemaId) {
              warn('Unable to load schemaId from Netlify Graph lockfile, run graph:pull to update')
              return
            }

            if (!schema) {
              warn('Unable to load schema from for Netlify Graph, run graph:pull to update')
              return
            }

            if (!currentPersistedDocId) {
              warn('Unable to read current persisted Graph library doc id')
              return
            }

            await handleCliSessionEvent({
              config,
              docId: currentPersistedDocId,
              netlifyToken,
              event,
              netlifyGraphConfig,
              schema,
              schemaId,
              sessionId: oneGraphSessionId,
              site,
              siteId: site.id,
              siteRoot: site.root,
            })
            log(`${chalk.green('Finished handling')} Netlify Graph: ${eventName}...`)
          }
        } catch (error_) {
          warn(`Error processing individual Netlify Graph event, skipping:
${JSON.stringify(error_, null, 2)}`)
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
export const markCliSessionInactive = async ({ netlifyToken, sessionId, siteId }) => {
  const { jwt } = await OneGraphClient.getGraphJwtForSite({ siteId, nfToken: netlifyToken })
  const result = await OneGraphClient.executeMarkCliSessionInactive(jwt, siteId, sessionId)
  if (!result || result.errors) {
    warn(`Unable to mark CLI session ${sessionId} inactive: ${JSON.stringify(result.errors, null, 2)}`)
  }
}

/**
 * Generate a session name that can be identified as belonging to the current checkout
 * @returns {string} The name of the session to create
 */
export const generateSessionName = () => {
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
 * @param {object} input.config The parsed netlify.toml config file
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {object} input.metadata
 * @param {string} input.netlifyToken
 * @param {import('../../utils/state-config.mjs').default} input.state
 * @param {string} [input.oneGraphSessionId]
 * @param {any} input.site The site object
 */
export const ensureCLISession = async (input) => {
  const { config, metadata, netlifyGraphConfig, netlifyToken, site, state } = input
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

      if (session && session.metadata && session.metadata.docId) {
        currentPersistedDocId = session.metadata.docId
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

  if (oneGraphSessionId) {
    await upsertMergeCLISessionMetadata({
      jwt,
      config,
      newMetadata: {},
      oneGraphSessionId,
      siteId: site.id,
      siteRoot: site.root,
    })
  } else {
    // If we can't access the session in the state.json or it doesn't exist, create a new one
    const sessionName = generateSessionName()
    const detectedMetadata = await detectLocalCLISessionMetadata({
      siteRoot: site.root,
    })
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

    if (oneGraphSession) {
      // @ts-expect-error
      oneGraphSessionId = oneGraphSession.id
    } else {
      warn('Unable to load Netlify Graph session, please report this to Netlify support')
    }
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

export const OneGraphCliClient = {
  ackCLISessionEvents: OneGraphClient.ackCLISessionEvents,
  executeCreatePersistedQueryMutation: OneGraphClient.executeCreatePersistedQueryMutation,
  executeCreateApiTokenMutation: OneGraphClient.executeCreateApiTokenMutation,
  fetchCliSessionEvents: OneGraphClient.fetchCliSessionEvents,
  fetchCliSessionSchema,
  ensureAppForSite: OneGraphClient.ensureAppForSite,
  updateCLISessionMetadata: OneGraphClient.updateCLISessionMetadata,
  getGraphJwtForSite: OneGraphClient.getGraphJwtForSite,
}

export { currentPersistedDocId, extractFunctionsFromOperationDoc }
