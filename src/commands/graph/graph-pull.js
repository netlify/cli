const process = require('process')

const { refetchAndGenerateFromOneGraph } = require('../../lib/one-graph/client')
const { getNetligraphConfig } = require('../../lib/one-graph/netligraph')
const { NETLIFYDEVERR, chalk } = require('../../utils')

const graphPull = async (options, command) => {
  const { site, state } = command.netlify

  if (!site.id) {
    console.error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netligraph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const netligraphConfig = getNetligraphConfig({ command, options })
  const netlifyToken = await command.authenticate()
  const siteId = site.id
  await refetchAndGenerateFromOneGraph({ netligraphConfig, netlifyToken, state, siteId })
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
