const fs = require('fs')
const process = require('process')

const { parse, printSchema } = require('graphql')

const { ensureAppForSite, fetchEnabledServices, fetchOneGraphSchema } = require('../../lib/oneGraph/client')
const {
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  netligraphPath,
  readGraphQLOperationsSourceFile,
} = require('../../lib/oneGraph/netligraph')
const { NETLIFYDEVERR, chalk } = require('../../utils')

const graphPull = async (options, command) => {
  const { site } = command.netlify
  const siteId = site.id

  if (!site.id) {
    console.error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netligraph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const netlifyToken = await command.authenticate()

  await ensureAppForSite(netlifyToken, siteId)

  const enabledServicesInfo = await fetchEnabledServices(netlifyToken, siteId)
  const enabledServices = enabledServicesInfo.map((service) => service.service)
  const schema = await fetchOneGraphSchema(siteId, enabledServices)
  let operationsDoc = readGraphQLOperationsSourceFile(netligraphPath)

  if (operationsDoc.trim().length === 0) {
    operationsDoc = `query ExampleQuery {
__typename
}`
  }

  const parsedDoc = parse(operationsDoc)

  const operations = extractFunctionsFromOperationDoc(parsedDoc)

  generateFunctionsFile(netligraphPath, schema, operationsDoc, operations)
  fs.writeFileSync(`${netligraphPath}/netligraphSchema.graphql`, printSchema(schema))
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
