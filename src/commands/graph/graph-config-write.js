// @ts-check
const fs = require('fs')
const path = require('path')
const process = require('process')

const { getNetlifyGraphConfig } = require('../../lib/one-graph/cli-netlify-graph')
const { NETLIFYDEVERR, chalk, error, log } = require('../../utils')

/**
 * Creates the `netlify graph:config:write` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphConfigWrite = async (options, command) => {
  const { site } = command.netlify

  if (!site.id) {
    error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netlify Graph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}`,
    )
  }

  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })

  const schemaPath = netlifyGraphConfig.graphQLSchemaFilename.join('/')

  // Support tools that looks for the schema under different keys
  const graphQLConfig = {
    schema: [schemaPath],
    schemaPath: [schemaPath],
  }

  const filePath = path.resolve(...netlifyGraphConfig.graphQLConfigJsonFilename)
  fs.writeFileSync(filePath, JSON.stringify(graphQLConfig, null, 2))

  const relativePath = path.relative(process.cwd(), filePath)
  log(`Wrote ${chalk.cyan(relativePath)}`)
}

/**
 * Creates the `netlify graph:config:write` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphConfigWriteCommand = (program) =>
  program
    .command('graph:config:write')
    .description(
      'Write a .graphqlrc.json file to the current directory for use with local tooling (e.g. the graphql extension for vscode)',
    )
    .action(async (options, command) => {
      await graphConfigWrite(options, command)
    })

module.exports = { createGraphConfigWriteCommand }
