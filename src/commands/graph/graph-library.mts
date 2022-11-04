// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'GraphQL'.
const { GraphQL } = require('netlify-onegraph-internal')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readLockfi... Remove this comment to see the full error message
const { readLockfile } = require('../../lib/one-graph/cli-client.cjs')
const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'buildSchem... Remove this comment to see the full error message
  buildSchema,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'defaultExa... Remove this comment to see the full error message
  defaultExampleOperationsDoc,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'extractFun... Remove this comment to see the full error message
  extractFunctionsFromOperationDoc,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'generateFu... Remove this comment to see the full error message
  generateFunctionsFile,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNetlify... Remove this comment to see the full error message
  getNetlifyGraphConfig,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'parse'.
  parse,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readGraphQ... Remove this comment to see the full error message
  readGraphQLOperationsSourceFile,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readGraphQ... Remove this comment to see the full error message
  readGraphQLSchemaFile,
} = require('../../lib/one-graph/cli-netlify-graph.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, chalk, error, log } = require('../../utils/index.mjs')

/**
 * Creates the `netlify graph:library` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const graphLibrary = async (options: $TSFixMe, command: $TSFixMe) => {
  const { config } = command.netlify
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  const schemaString = readGraphQLSchemaFile(netlifyGraphConfig)

  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

  let schema

  try {
    schema = buildSchema(schemaString)
  } catch (buildSchemaError) {
    error(`Error parsing schema: ${buildSchemaError}`)
  }

  if (!schema) {
    error(`Failed to parse Netlify GraphQL schema`)
    return
  }

  const lockfile = readLockfile({ siteRoot: command.netlify.site.root })

  if (lockfile === undefined) {
    error(
      `${NETLIFYDEVERR} Error: no lockfile found, unable to run \`netlify graph:library\`. To pull a remote schema (and create a lockfile), run ${chalk.yellow(
        'netlify graph:pull',
      )} `,
    )
    return
  }

  const { schemaId } = lockfile.locked

  const payload = {
    config,
    logger: log,
    netlifyGraphConfig,
    schema,
    schemaId,
    operationsDoc: currentOperationsDoc,
    functions,
    fragments,
  }

  generateFunctionsFile(payload)
}

/**
 * Creates the `netlify graph:library` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const createGraphLibraryCommand = (program: $TSFixMe) => program
  .command('graph:library')
  .description('Generate the Graph function library')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await graphLibrary(options, command)
  })

module.exports = { createGraphLibraryCommand }
