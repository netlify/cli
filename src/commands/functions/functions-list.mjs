// @ts-check
import AsciiTable from 'ascii-table'

import { exit, log, logJson } from '../../utils/command-helpers.mjs'
import { getFunctions, getFunctionsDir } from '../../utils/functions/index.mjs'
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

const normalizeFunction = function (deployedFunctions, { name, urlPath: url }) {
  const isDeployed = deployedFunctions.some((deployedFunction) => deployedFunction.n === name)
  return { name, url, isDeployed }
}

/**
 * The functions:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const functionsList = async (options, command) => {
  const { config, siteInfo } = command.netlify

  const deploy = siteInfo.published_deploy || {}
  const deployedFunctions = deploy.available_functions || []

  const functionsDir = getFunctionsDir({ options, config })

  if (typeof functionsDir === 'undefined') {
    log('Functions directory is undefined')
    log('Please verify functions.directory is set in your Netlify configuration file (netlify.toml/yml/json)')
    log('See https://docs.netlify.com/configure-builds/file-based-configuration/ for more information')
    exit(1)
  }

  const functions = await getFunctions(functionsDir)
  const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions))

  if (normalizedFunctions.length === 0) {
    log(`No functions found in ${functionsDir}`)
    exit()
  }

  if (options.json) {
    logJson(normalizedFunctions)
    exit()
  }

  // Make table
  log(`Based on local functions folder ${functionsDir}, these are the functions detected`)
  const table = new AsciiTable(`Netlify Functions (in local functions folder)`)
  table.setHeading('Name', 'URL', 'deployed')
  normalizedFunctions.forEach(({ isDeployed, name, url }) => {
    table.addRow(name, url, isDeployed ? 'yes' : 'no')
  })
  log(table.toString())
}

/**
 * Creates the `netlify functions:list` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsListCommand = (program) =>
  program
    .command('functions:list')
    .alias('function:list')
    .description(
      `List functions that exist locally
Helpful for making sure that you have formatted your functions correctly

NOT the same as listing the functions that have been deployed. For that info you need to go to your Netlify deploy log.`,
    )
    .option('-f, --functions <dir>', 'Specify a functions directory to list')
    .option('--json', 'Output function data as JSON')
    .hook('preAction', requiresSiteInfo)
    .action(functionsList)
