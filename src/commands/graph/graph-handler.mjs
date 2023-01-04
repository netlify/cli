/* eslint-disable eslint-comments/disable-enable-pair */
// @ts-check

import {
  autocompleteCodegenModules,
  autocompleteOperationNames,
  buildSchema,
  generateHandlerByOperationName,
  getCodegenFunctionById,
  getCodegenModule,
  getNetlifyGraphConfig,
  readGraphQLSchemaFile,
} from '../../lib/one-graph/cli-netlify-graph.mjs'
import { error, log } from '../../utils/command-helpers.mjs'

/**
 * Creates the `netlify graph:handler` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
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

  const userOperationNames = args.operationNames
  const userCodegenId = options.codegen

  const handlerOptions = options.data ? JSON.parse(options.data) : {}

  let operationNames = userOperationNames
  if (!operationNames || operationNames.length === 0) {
    const operationName = await autocompleteOperationNames({ netlifyGraphConfig })
    operationNames = [operationName]
  }

  if (!operationNames || operationNames.length === 0) {
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
    /* eslint-disable fp/no-loops */
    for (const operationName of operationNames) {
      await generateHandlerByOperationName({
        generate: codeGenerator.generateHandler,
        logger: log,
        netlifyGraphConfig,
        schema,
        operationName,
        handlerOptions,
      })
    }
  } else {
    error(`Failed to parse Netlify GraphQL schema`)
  }
}

/**
 * Creates the `netlify graph:handler` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphHandlerCommand = (program) =>
  program
    .command('graph:handler')
    .argument('[name...]', 'Operation name(s)')
    .option('-c, --codegen <id>', 'The id of the specific code generator to use')
    .option("-d, --data '<json>'", 'Optional data to pass along to the code generator')
    .description(
      'Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.',
    )
    .action(async (operationNames, options, command) => {
      await graphHandler({ operationNames }, options, command)
    })
