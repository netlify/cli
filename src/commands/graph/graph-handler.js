// @ts-check
const {
  buildSchema,
  generateHandlerByOperationName,
  getNetlifyGraphConfig,
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error } = require('../../utils')

/**
 * Creates the `netlify graph:handler` command
 * @param {string} operationName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphHandler = async (operationName, options, command) => {
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

  generateHandlerByOperationName(netlifyGraphConfig, schema, operationName, {})
}

/**
 * Creates the `netlify graph:handler` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphHandlerCommand = (program) =>
  program
    .command('graph:handler')
    .argument('<name>', 'Operation name')
    .description(
      'Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.',
    )
    .action(async (operationName, options, command) => {
      await graphHandler(operationName, options, command)
    })

module.exports = { createGraphHandlerCommand }
