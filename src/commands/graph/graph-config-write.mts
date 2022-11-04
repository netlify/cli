// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fs'.
const fs = require('fs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getNetlify... Remove this comment to see the full error message
const { getNetlifyGraphConfig } = require('../../lib/one-graph/cli-netlify-graph.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, chalk, error, log } = require('../../utils/index.mjs')

/**
 * Creates the `netlify graph:config:write` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const graphConfigWrite = async (options: $TSFixMe, command: $TSFixMe) => {
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const createGraphConfigWriteCommand = (program: $TSFixMe) => program
  .command('graph:config:write')
  .description(
    'Write a .graphqlrc.json file to the current directory for use with local tooling (e.g. the graphql extension for vscode)',
  )
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await graphConfigWrite(options, command)
  })

module.exports = { createGraphConfigWriteCommand }
