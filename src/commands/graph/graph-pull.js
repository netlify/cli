/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
const fs = require('fs')

const { printSchema } = require('graphql')

const { fetchOneGraphSchema } = require('../../lib/oneGraph/client')
const { extractFunctionsFromOperationDoc, generateFunctionsFile, netligraphPath, readAndParseGraphQLOperationsSourceFile, readGraphQLOperationsSourceFile, writeGraphQLOperationsSourceFile } = require('../../lib/oneGraph/netligraph')

const graphPull = async (options, command) => {
  const { site } = command.netlify
  const siteId = site.id

  // TODO: Get this from the app
  const enabledServices = ['npm']

  const basePath = netligraphPath()
  const schema = await fetchOneGraphSchema(siteId, enabledServices)
  const [parsedDoc] = readAndParseGraphQLOperationsSourceFile(basePath)
  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  const operationsDoc = readGraphQLOperationsSourceFile(basePath)

  generateFunctionsFile(basePath, schema, operationsDoc, operations)
  fs.writeFileSync(`${basePath}/netligraphSchema.graphql`, printSchema(schema))
}

/**
 * Creates the `netlify graph:pull` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphPullCommand = (program) =>
  program
    .command('graph:pull')
    .description('Pull down your local Netligraph schema and regenerate your local functions')
    .action(async (options, command) => {
      await graphPull(options, command)
    })


module.exports = { createGraphPullCommand }
