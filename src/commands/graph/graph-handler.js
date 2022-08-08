/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
// @ts-check
const {
  autocompleteCodegenModules,
  autocompleteOperationNames,
  buildSchema,
  generateHandlerByOperationName,
  getCodegenFunctionById,
  getCodegenModule,
  getNetlifyGraphConfig,
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

/**
 * Creates the `netlify graph:handler` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphHandler = async (args, options, command) => {
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  const { config } = command.netlify

  const schemaString = readGraphQLSchemaFile(netlifyGraphConfig)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (buildSchemaError) {
    error(`Error parsing schema: ${buildSchemaError}`)
  }

  const userOperationName = args.operationName
  const userCodegenId = options.codegen

  let operationName = userOperationName
  if (!operationName) {
    operationName = await autocompleteOperationNames({ netlifyGraphConfig })
  }

  if (!operationName) {
    error(`No operation name provided`)
  }

  const codegenModule = await getCodegenModule({ config })
  if (!codegenModule) {
    error(
      `No Netlify Graph codegen module specified in netlify.toml under the [graph] header. Please specify 'codeGenerator' field and try again.`,
    )
    return
  }

  let codeGenerator = userCodegenId ? await getCodegenFunctionById({ config, id: userCodegenId }) : null
  if (!codeGenerator) {
    codeGenerator = await autocompleteCodegenModules({ config })
  }

  if (!codeGenerator) {
    error(`Unable to select appropriate Netlify Graph code generator`)
    return
  }

  if (schema) {
    generateHandlerByOperationName({
      generate: codeGenerator.generateHandler,
      logger: log,
      netlifyGraphConfig,
      schema,
      operationName,
      handlerOptions: {},
    })
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
    .option('-c, --codegen <id>', 'Code generator to use')
    .description(
      'Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.',
    )
    .action(async (operationName, options, command) => {
      await graphHandler({ operationName }, options, command)
    })

module.exports = { createGraphHandlerCommand }
