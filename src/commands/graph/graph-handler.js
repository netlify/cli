/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
// @ts-check
const {
  autocompleteOperationNames,
  buildSchema,
  generateHandlerByOperationName,
  getNetlifyGraphConfig,
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

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

  let operationName = userOperationName
  if (!operationName) {
    operationName = await autocompleteOperationNames({ netlifyGraphConfig })
  }

  if (!operationName) {
    error(`No operation name provided`)
  }

  if (schema) {
    // TODO
    // generateHandlerByOperationName({ logger: log, netlifyGraphConfig, schema, ope/rationName, handlerOptions: {} })
  } else {
    error(`Failed to parse Netlify GraphQL schema`)
  }
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
