const process = require('process')

const { refetchAndGenerateFromOneGraph } = require('../../lib/oneGraph/client')
const { NETLIFYDEVERR, chalk } = require('../../utils')

const graphPull = async (options, command) => {
  const { site } = command.netlify

  if (!site.id) {
    console.error(
      `${NETLIFYDEVERR} Warning: no siteId defined, unable to start Netligraph. To enable, run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const netlifyToken = await command.authenticate()
  refetchAndGenerateFromOneGraph(state, netlifyToken, site.id)
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
