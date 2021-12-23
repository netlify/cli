/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
const fs = require('fs')

const { printSchema } = require('graphql')

const { fetchOneGraphSchema } = require('../../lib/oneGraph/client')
const {
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  netligraphPath,
  readAndParseGraphQLOperationsSourceFile,
  readGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
} = require('../../lib/oneGraph/netligraph')

const graphCreate = async (options, command) => {
  const { site } = command.netlify
  const siteId = site.id

  // TODO: Get this from the app on OneGraph
  const defaultEnabledServices = ['github', 'npm']

  const basePath = netligraphPath()
  const schema = await fetchOneGraphSchema(siteId, defaultEnabledServices)
  const [parsedDoc] = readAndParseGraphQLOperationsSourceFile(basePath)
  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  const operationsDoc = readGraphQLOperationsSourceFile(basePath)

  generateFunctionsFile(basePath, schema, operationsDoc, operations)
  fs.writeFileSync(`${basePath}/netligraphSchema.graphql`, printSchema(schema))
}

/**
 * Creates the `netlify graph:create` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphCreateCommand = (program) =>
  program
    .command('graph:create')
    .description('Create down your local Netligraph schema and regenerate your local functions')
    .action(async (options, command) => {
      await graphCreate(options, command)
    })

module.exports = { createGraphCreateCommand }
