// @ts-check
const { OneGraphClient } = require('netlify-onegraph-internal')

const {
  getNetlifyGraphConfig,
  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error } = require('../../utils')

const { importOperationHelper } = require('./import-operation-helper')

/**
 * Creates the `netlify graph:operations:import` command
 * @param {string} operationId
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphOperationsImport = async (operationId, options, command) => {
  const { site, state } = command.netlify
  const netlifyToken = await command.authenticate()
  const siteId = site.id
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  const result = await OneGraphClient.fetchSharedDocumentQuery(
    {
      id: operationId,
      nfToken: netlifyToken,
    },
    {
      siteId,
    },
  )

  const sharedDocument = result.data && result.data.oneGraph && result.data.oneGraph.sharedDocument

  if (!sharedDocument) {
    error(`Unable to import operation with id ${operationId}, ${JSON.stringify(result, null, 2)}`)
  }

  let errorMessage = null

  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles(netlifyGraphConfig)

  importOperationHelper({
    error: (message) => {
      errorMessage = message
    },
    netlifyGraphConfig,
    operationId,
    sharedDocument,
    site,
    state,
  })

  if (errorMessage) {
    error(errorMessage)
  }
}

/**
 * Creates the `netlify graph:operations:import` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphOperationsImportCommand = (program) =>
  program
    .command('graph:operations:import')
    .argument('<id>', 'Operation id')
    .description(
      'Import an operation from the Netlify community to incorporate into your app and regenerate your function library',
    )
    .action(async (operationName, options, command) => {
      await graphOperationsImport(operationName, options, command)
    })

module.exports = { createGraphOperationsImportCommand }
