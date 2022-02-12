// @ts-check
const {
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  getNetlifyGraphConfig,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

/**
 * Creates the `netlify graph:library` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphLibrary = async (options, command) => {
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

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile({
    logger: log,
    netlifyGraphConfig,
    schema,
    operationsDoc: currentOperationsDoc,
    functions,
    fragments,
  })
}

/**
 * Creates the `netlify graph:library` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphLibraryCommand = (program) =>
  program
    .command('graph:library')
    .description('Generate the Graph function library')
    .action(async (options, command) => {
      await graphLibrary(options, command)
    })

module.exports = { createGraphLibraryCommand }
