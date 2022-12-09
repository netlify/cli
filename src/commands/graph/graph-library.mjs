// @ts-check
import { GraphQL } from 'netlify-onegraph-internal'

import { readLockfile } from '../../lib/one-graph/cli-client.mjs'
import {
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  getNetlifyGraphConfig,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
} from '../../lib/one-graph/cli-netlify-graph.mjs'
import { NETLIFYDEVERR, chalk, error, log } from '../../utils/command-helpers.mjs'

/**
 * Creates the `netlify graph:library` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns
 */
const graphLibrary = async (options, command) => {
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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphLibraryCommand = (program) =>
  program
    .command('graph:library')
    .description('Generate the Graph function library')
    .action(async (options, command) => {
      await graphLibrary(options, command)
    })
