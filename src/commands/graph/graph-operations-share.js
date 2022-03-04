// @ts-check
const inquirer = require('inquirer')
// eslint-disable-next-line no-unused-vars
const { GraphQL, GraphQLHelpers, NetlifyGraph } = require('netlify-onegraph-internal')
const { OneGraphClient } = require('netlify-onegraph-internal')

const {
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  getNetlifyGraphConfig,
  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles,
  readGraphQLOperationsSourceFiles,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

const { parse } = GraphQL

/**
 * Creates the `netlify graph:operations:share` command
 * @param {string} userOperationName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphOperationsShare = async (userOperationName, options, command) => {
  const { site } = command.netlify
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  potentiallyMigrateLegacySingleOperationsFileToMultipleOperationsFiles(netlifyGraphConfig)

  const netlifyToken = await command.authenticate()
  const siteId = site.id

  let currentOperationsDoc = readGraphQLOperationsSourceFiles(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  /**
   * @type {NetlifyGraph.ExtractedFunction | NetlifyGraph.ExtractedFragment}
   */
  let targetOperation

  let operationName = userOperationName
  try {
    const parsedDoc = parse(currentOperationsDoc)
    const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

    const sorted = Object.values(functions).sort((aItem, bItem) =>
      aItem.operationName.localeCompare(bItem.operationName),
    )

    const perPage = 50

    const allOperationChoices = sorted.map((operation) => ({
      name: `${operation.operationName} (${operation.kind})`,
      value: operation,
    }))

    const filterOperationNames = (operationChoices, input) =>
      operationChoices.filter((operation) =>
        (operation.value.operationName || operation.value.fragmentName).toLowerCase().match(input.toLowerCase()),
      )
    // eslint-disable-next-line node/global-require
    const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt')
    /** multiple matching detectors, make the user choose */
    inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

    if (operationName) {
      targetOperation = functions[operationName] || fragments[operationName]
    } else {
      const { selectedOperation } = await inquirer.prompt({
        name: 'selectedOperation',
        message: `Which operation would you like to submit for others to use?`,
        // @ts-ignore
        type: 'autocomplete',
        pageSize: perPage,
        source(_, input) {
          if (!input || input === '') {
            return allOperationChoices
          }

          const filteredChoices = filterOperationNames(allOperationChoices, input)
          // only show filtered results
          return filteredChoices
        },
      })

      if (selectedOperation) {
        targetOperation = selectedOperation
        // eslint-disable-next-line prefer-destructuring
        operationName = selectedOperation.operationName
      }
    }
  } catch (parseError) {
    error(`Error parsing operations library: ${parseError}`)
  }

  if (!targetOperation) {
    error(`No operation found with name ${operationName}`)
  }

  const hardCodedValues = GraphQLHelpers.gatherHardcodedValues(targetOperation.operationString)

  if (hardCodedValues.length !== 0) {
    log(`The following values are hardcoded in the operation:`)
    hardCodedValues.forEach(([name, value]) => {
      log(`\t${name}: ${value}`)
    })

    const { confirm } = await inquirer.prompt({
      name: 'confirm',
      message: 'Are you sure you want to share this operation? These values will be visible to others.',
      type: 'confirm',
    })

    if (!confirm) {
      log('Operation sharing cancelled')
      return
    }
  }

  log(`Sharing operation ${operationName}...`)

  const result = await OneGraphClient.executeCreateSharedDocumentMutation(
    {
      input: {
        body: targetOperation.operationString,
        description: targetOperation.description,
        siteId,
      },
      nfToken: netlifyToken,
    },
    {
      siteId,
    },
  )

  if (result.errors) {
    error(`Error sharing operation: ${JSON.stringify(result, null, 2)}`)
  }

  const sharedDocument =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.createSharedDocument &&
    result.data.oneGraph.createSharedDocument.sharedDocument

  if (!sharedDocument) {
    error('Error sharing operation, no shared document returned')
  }

  log(
    `Finished sharing operation ${operationName}, importable with \`ntl graph:operations:import ${sharedDocument.id}\``,
  )
}

/**
 * Creates the `netlify graph:operations:share` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphOperationsShareCommand = (program) =>
  program
    .command('graph:operations:share')
    .argument('[name]', 'Operation name')
    .description(
      'Share an operation from your app for others in the Netlify community to incorporate into their app <3',
    )
    .action(async (operationName, options, command) => {
      await graphOperationsShare(operationName, options, command)
    })

module.exports = { createGraphOperationsShareCommand }
