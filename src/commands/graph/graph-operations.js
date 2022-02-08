// @ts-check
const { GraphQL } = require('netlify-onegraph-internal')

const {
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  getNetlifyGraphConfig,
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph')
const { log } = require('../../utils')

const { parse } = GraphQL

/**
 * Creates the `netlify graph:operations` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphOperations = async (options, command) => {
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  try {
    let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
    if (currentOperationsDoc.trim().length === 0) {
      currentOperationsDoc = defaultExampleOperationsDoc
    }

    const parsedDoc = parse(currentOperationsDoc)
    const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)

    const sorted = {
      queries: [],
      mutations: [],
      subscriptions: [],
      fragments: [],
      other: [],
    }

    // Sort the operations by name and add them to the correct array under the operation type in sorted
    Object.values(functions)
      .sort((aItem, bItem) => aItem.operationName.localeCompare(bItem.operationName))
      .forEach((operation) => {
        switch (operation.kind) {
          case 'query': {
            sorted.queries.push(operation)

            break
          }
          case 'mutation': {
            sorted.mutations.push(operation)

            break
          }
          case 'subscription': {
            sorted.subscriptions.push(operation)

            break
          }
          default: {
            sorted.other.push(operation)
          }
        }
      })

    Object.values(fragments)
      .sort((aItem, bItem) => aItem.fragmentName.localeCompare(bItem.fragmentName))
      .forEach((fragment) => {
        sorted.fragments.push(fragment)
      })

    if (sorted.queries.length !== 0) {
      log(`Queries:`)
      sorted.queries.forEach((operation) => {
        log(`\t${operation.operationName}`)
      })
    }
    if (sorted.mutations.length !== 0) {
      log(`Mutations:`)
      sorted.mutations.forEach((operation) => {
        log(`\t${operation.operationName}`)
      })
    }
    if (sorted.subscriptions.length !== 0) {
      log(`Subscriptions:`)
      sorted.subscriptions.forEach((operation) => {
        log(`\t${operation.operationName}`)
      })
    }
    if (sorted.fragments.length !== 0) {
      log(`Fragments:`)
      sorted.fragments.forEach((fragment) => {
        log(`\t${fragment.fragmentName}`)
      })
    }
  } catch (error) {
    error(`Error parsing operations library: ${error}`)
  }
}

/**
 * Creates the `netlify graph:operations` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphOperationCommand = (program) =>
  program
    .command('graph:operations')
    .description('List all of the locally available operations')
    .action(async (options, command) => {
      await graphOperations(options, command)
    })

module.exports = { createGraphOperationCommand }
