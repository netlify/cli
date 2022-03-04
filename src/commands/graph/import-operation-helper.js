// @ts-check
/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-else-return */
const path = require('path')

const inquirer = require('inquirer')
// eslint-disable-next-line no-unused-vars
const { GraphQL, NetlifyGraph } = require('netlify-onegraph-internal')
const { OneGraphClient } = require('netlify-onegraph-internal')

const {
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  normalizeOperationsDoc,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
// eslint-disable-next-line no-unused-vars
const { StateConfig, log, warn } = require('../../utils')

const { parse } = GraphQL

const getEnabledGraphServices = ({ state }) => state.get('oneGraphEnabledServices') || []

const addNewGraphServicesAndRefreshSchema = async ({ netlifyGraphConfig, newServices, siteId, state }) => {
  const services = getEnabledGraphServices({ state })
  const newServicesWithExistingServices = [...newServices, ...services]
    .filter((item, index, self) => self.indexOf(item) === index)
    .sort()
  state.set('oneGraphEnabledServices', newServicesWithExistingServices)
  const enabledServices = getEnabledGraphServices({ state })
  const schema = await OneGraphClient.fetchOneGraphSchema(siteId, enabledServices)
  writeGraphQLSchemaFile({ logger: log, netlifyGraphConfig, schema })
}

/**
 * Creates the `netlify graph:operations:import` command
 * @param {object} input
 * @param {string} input.operationId
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig A standalone config object that contains all the information necessary for Netlify Graph to process events
 * @param {object} input.sharedDocument
 * @param {any} input.site The site object
 * @param {StateConfig} input.state A function to call to set/get the current state of the local Netlify project
 * @param {(message:string) => void} input.error A function to call to log an error
 * @returns
 */
const importOperationHelper = async ({ error, netlifyGraphConfig, operationId, sharedDocument, site, state }) => {
  const siteId = site.id

  const enabledServices = getEnabledGraphServices({ state })

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  let existingLibraryNamesAndIds

  try {
    const parsedDoc = parse(currentOperationsDoc)
    const existingLibrary = extractFunctionsFromOperationDoc(parsedDoc)

    existingLibraryNamesAndIds = {
      ids: [
        ...Object.values(existingLibrary.functions).map(({ id }) => id),
        ...Object.values(existingLibrary.fragments).map(({ id }) => id),
      ],
      names: [
        ...Object.values(existingLibrary.functions).map(({ operationName }) => operationName),
        ...Object.values(existingLibrary.fragments).map(({ fragmentName }) => fragmentName),
      ],
    }
  } catch (parseError) {
    return error(`Error parsing operations library: ${parseError}`)
  }

  if (!sharedDocument) {
    return error(`Unable to import operation with id ${operationId}`)
  }

  if (sharedDocument.moderationStatus !== 'PUBLISHED') {
    warn(
      `Operation with id ${operationId} is not published, it has not been reviewed by any human. Please review it carefully before using it.`,
    )
  }

  log(`Checking ${sharedDocument.operationName} for conflicts...`)

  let newLibrary
  try {
    newLibrary = extractFunctionsFromOperationDoc(parse(sharedDocument.body))
  } catch (parseError) {
    return error(`Error parsing imported operation: ${parseError}`)
  }

  const functionConflicts = {
    nameConflicts: Object.values(newLibrary.functions).filter((fn) =>
      existingLibraryNamesAndIds.names.includes(fn.operationName),
    ),
    idConflicts: Object.values(newLibrary.functions).filter((fn) =>
      existingLibraryNamesAndIds.ids.includes(fn.operationName),
    ),
  }

  const fragmentConflicts = {
    nameConflicts: Object.values(newLibrary.fragments).filter((fn) =>
      existingLibraryNamesAndIds.names.includes(fn.fragmentName),
    ),
    idConflicts: Object.values(newLibrary.fragments).filter((fn) =>
      existingLibraryNamesAndIds.ids.includes(fn.fragmentName),
    ),
  }

  const allConflictingNames = [
    ...functionConflicts.nameConflicts.map(({ operationName }) => operationName),
    ...fragmentConflicts.nameConflicts.map(({ fragmentName }) => fragmentName),
  ]

  const allConflictingIds = [
    ...functionConflicts.idConflicts.map(({ id }) => id),
    ...fragmentConflicts.idConflicts.map(({ id }) => id),
  ]

  if (allConflictingNames.length !== 0 || allConflictingIds.length !== 0) {
    let message = `The following conflicts were found in ${netlifyGraphConfig.graphQLOperationsSourceFilename.join(
      path.sep,
    )}:`
    if (allConflictingNames.length !== 0) {
      const verb = allConflictingNames.length === 1 ? 'is' : 'are'
      message += `\n- Names: [${allConflictingNames.join(', ')}] ${verb} already in use locally.`
    }
    if (allConflictingIds.length !== 0) {
      const verb = allConflictingIds.length === 1 ? 'is' : 'are'
      message += `\n- ids: [${allConflictingIds.join(', ')}] ${verb} already in use locally.`
    }

    error(`${message}

Operation "${sharedDocument.operationName}" contains conflicts with existing operations, please rename or delete it in your local GraphQL file.`)
    return
  } else {
    const newOperationsDoc = `${currentOperationsDoc}

${sharedDocument.body}`

    const requiredServices = sharedDocument.services.map((service) => service.service)

    const missingServices = requiredServices.filter((service) => !enabledServices.includes(service))

    if (missingServices.length !== 0) {
      warn(`Operation with id ${operationId} requires services ${missingServices.join(', ')} to be enabled.`)
      const { confirm } = await inquirer.prompt({
        name: 'confirm',
        message: 'Enable missing services?',
        type: 'confirm',
      })

      if (confirm) {
        await addNewGraphServicesAndRefreshSchema({
          netlifyGraphConfig,
          newServices: missingServices,
          siteId,
          state,
        })
      } else {
        log('Operation import cancelled')
        return
      }
    }

    const operationsDocString = normalizeOperationsDoc(newOperationsDoc)

    const schemaString = readGraphQLSchemaFile(netlifyGraphConfig)

    let schema

    try {
      schema = buildSchema(schemaString)
    } catch (buildSchemaError) {
      return error(`Error parsing schema: ${buildSchemaError}`)
    }

    if (!schema) {
      return error(`Failed to parse Netlify GraphQL schema`)
    }

    writeGraphQLOperationsSourceFile({ logger: log, netlifyGraphConfig, operationsDocString })

    const operationsDocFromDisk = readGraphQLOperationsSourceFile(netlifyGraphConfig)

    const { fragments, functions } = extractFunctionsFromOperationDoc(parse(operationsDocFromDisk))

    await generateFunctionsFile({
      logger: log,
      netlifyGraphConfig,
      schema,
      operationsDoc: currentOperationsDoc,
      functions,
      fragments,
    })
  }

  log(`Finished importing operation ${sharedDocument.operationName}`)
}

module.exports = { importOperationHelper }
