// @ts-check
const { Option } = require('commander')

const {
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  generatePersistedFunctionsFile,
  getNetlifyGraphConfig,
  normalizeOperationsDoc,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  writeGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { error, log, warn } = require('../../utils')

/**
 * Creates the `netlify graph:library` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphLibrary = async (options, command) => {
  const { site } = command.netlify
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
    if (options.production) {
      warn('No Graph operations library found, skipping production client generation.')
      return
    }
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const normalizedOperationsDoc = normalizeOperationsDoc(currentOperationsDoc)

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

  if (options.production) {
    const netlifyToken = await command.authenticate()

    await generatePersistedFunctionsFile({
      logger: log,
      netlifyGraphConfig,
      schema,
      operationsDoc: currentOperationsDoc,
      functions,
      fragments,
      siteId: site.id,
      netlifyToken,
    })
  } else {
    await generateFunctionsFile({
      logger: log,
      netlifyGraphConfig,
      schema,
      operationsDoc: currentOperationsDoc,
      functions,
      fragments,
    })
  }

  writeGraphQLOperationsSourceFile({
    logger: log,
    netlifyGraphConfig,
    operationsDocString: normalizedOperationsDoc,
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
    .addOption(
      new Option(
        '--production',
        'Generate a type-compatible library ready for production based on persisted queries',
      ).hideHelp(),
    )
    .action(async (options, command) => {
      await graphLibrary(options, command)
    })

module.exports = { createGraphLibraryCommand }
