// @ts-check

const { GraphQL } = require('netlify-onegraph-internal')

const {
  
  defaultExampleOperationsDoc,
  
  extractFunctionsFromOperationDoc,
  
  getNetlifyGraphConfig,
  
  readGraphQLOperationsSourceFile,
} = require('../../lib/one-graph/cli-netlify-graph.mjs')

const { log } = require('../../utils/index.mjs')


const { parse } = GraphQL

/**
 * Creates the `netlify graph:operations` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */

const graphOperations = async (options: $TSFixMe, command: $TSFixMe) => {
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  try {
    let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
    if (currentOperationsDoc.trim().length === 0) {
      currentOperationsDoc = defaultExampleOperationsDoc
    }

    const parsedDoc = parse(currentOperationsDoc)
    const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

    const sorted = {
      /** @type {import('netlify-onegraph-internal/dist/netlifyGraph').ExtractedFunction[]} */
      queries: [],
      /** @type {import('netlify-onegraph-internal/dist/netlifyGraph').ExtractedFunction[]} */
      mutations: [],
      /** @type {import('netlify-onegraph-internal/dist/netlifyGraph').ExtractedFunction[]} */
      subscriptions: [],
      /** @type {import('netlify-onegraph-internal/dist/netlifyGraph').ExtractedFragment[]} */
      fragments: [],
      /** @type {any[]} */
      other: [],
    }

    // Sort the operations by name and add them to the correct array under the operation type in sorted
Object.values(functions)
    
    .sort((aItem, bItem) => (aItem as $TSFixMe).operationName.localeCompare((bItem as $TSFixMe).operationName))
    .forEach((operation) => {
    
    switch ((operation as $TSFixMe).kind) {
        case 'query': {
            // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            sorted.queries.push(operation);
            break;
        }
        case 'mutation': {
            // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            sorted.mutations.push(operation);
            break;
        }
        case 'subscription': {
            // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            sorted.subscriptions.push(operation);
            break;
        }
        default: {
            // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            sorted.other.push(operation);
        }
    }
});

    Object.values(fragments)
    
    .sort((aItem, bItem) => (aItem as $TSFixMe).fragmentName.localeCompare((bItem as $TSFixMe).fragmentName))
    .forEach((fragment) => {
    // @ts-expect-error TS(2345): Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
    sorted.fragments.push(fragment);
});

    if (sorted.queries.length !== 0) {
      log(`Queries:`)
      sorted.queries.forEach((operation) => {
    
    log(`\t${(operation as $TSFixMe).operationName}`);
});
    }
    if (sorted.mutations.length !== 0) {
      log(`Mutations:`)
      sorted.mutations.forEach((operation) => {
    
    log(`\t${(operation as $TSFixMe).operationName}`);
});
    }
    if (sorted.subscriptions.length !== 0) {
      log(`Subscriptions:`)
      sorted.subscriptions.forEach((operation) => {
    
    log(`\t${(operation as $TSFixMe).operationName}`);
});
    }
    if (sorted.fragments.length !== 0) {
      log(`Fragments:`)
      sorted.fragments.forEach((fragment) => {
    
    log(`\t${(fragment as $TSFixMe).fragmentName}`);
});
    }
  } catch (error) {
    
    (error as $TSFixMe)(`Error parsing operations library: ${error}`);
  }
}

/**
 * Creates the `netlify graph:operations` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

const createGraphOperationsCommand = (program: $TSFixMe) => program
  .command('graph:operations')
  .description('List all of the locally available operations')
  
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await graphOperations(options, command)
  })

export default { createGraphOperationsCommand }
