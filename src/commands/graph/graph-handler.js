// @ts-check
const inquirer = require('inquirer')
const { GraphQL } = require('netlify-onegraph-internal')

const {
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateHandlerByOperationName,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

const { parse } = GraphQL

/**
 * Creates the `netlify graph:handler` command
 * @param {string} userOperationName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphHandler = async (userOperationName, options, command) => {
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  const schemaString = readGraphQLSchemaFile(netlifyGraphConfig)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (buildSchemaError) {
    error(`Error parsing schema: ${buildSchemaError}`)
  }

  if (!schema) {
    error(`Failed to parse Netlify GraphQL schema`)
  }

  let operationName = userOperationName
  if (!operationName) {
    try {
      let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
      if (currentOperationsDoc.trim().length === 0) {
        currentOperationsDoc = defaultExampleOperationsDoc
      }

      const parsedDoc = parse(currentOperationsDoc)
      const { functions } = extractFunctionsFromOperationDoc(parsedDoc)

      const sorted = Object.values(functions).sort((aItem, bItem) =>
        aItem.operationName.localeCompare(bItem.operationName),
      )

      const perPage = 50

      const allOperationChoices = sorted.map((operation) => ({
        name: `${operation.operationName} (${operation.kind})`,
        value: operation.operationName,
      }))

      const filterOperationNames = (operationChoices, input) =>
        operationChoices.filter((operation) => operation.value.toLowerCase().match(input.toLowerCase()))

      // eslint-disable-next-line n/global-require
      const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt')
      /** multiple matching detectors, make the user choose */
      inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

      const { selectedOperationName } = await inquirer.prompt({
        name: 'selectedOperationName',
        message: `For which operation would you like to generate a handler?`,
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

      if (selectedOperationName) {
        operationName = selectedOperationName
      }
    } catch (parseError) {
      parseError(`Error parsing operations library: ${parseError}`)
    }
  }

  if (!operationName) {
    error(`No operation name provided`)
  }

  generateHandlerByOperationName({ logger: log, netlifyGraphConfig, schema, operationName, handlerOptions: {} })
}

/**
 * Creates the `netlify graph:handler` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphHandlerCommand = (program) =>
  program
    .command('graph:handler')
    .argument('[name]', 'Operation name')
    .description(
      'Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.',
    )
    .action(async (operationName, options, command) => {
      await graphHandler(operationName, options, command)
    })

module.exports = { createGraphHandlerCommand }
