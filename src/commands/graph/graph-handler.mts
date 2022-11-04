/* eslint-disable eslint-comments/disable-enable-pair */
// @ts-check

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'autocomple... Remove this comment to see the full error message
  autocompleteCodegenModules,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'autocomple... Remove this comment to see the full error message
  autocompleteOperationNames,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'buildSchem... Remove this comment to see the full error message
  buildSchema,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'generateHa... Remove this comment to see the full error message
  generateHandlerByOperationName,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getCodegen... Remove this comment to see the full error message
  getCodegenFunctionById,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getCodegen... Remove this comment to see the full error message
  getCodegenModule,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNetlify... Remove this comment to see the full error message
  getNetlifyGraphConfig,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readGraphQ... Remove this comment to see the full error message
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
const { error, log } = require('../../utils/index.mjs')

/**
 * Creates the `netlify graph:handler` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const graphHandler = async (args: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const createGraphHandlerCommand = (program: $TSFixMe) => program
  .command('graph:handler')
  .argument('[name...]', 'Operation name(s)')
  .option('-c, --codegen <id>', 'The id of the specific code generator to use')
  .option("-d, --data '<json>'", 'Optional data to pass along to the code generator')
  .description(
    'Generate a handler for a Graph operation given its name. See `graph:operations` for a list of operations.',
  )
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (operationNames: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await graphHandler({ operationNames }, options, command)
  })

module.exports = { createGraphHandlerCommand }
