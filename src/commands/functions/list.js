const process = require('process')

const { flags: flagsLib } = require('@oclif/command')
const AsciiTable = require('ascii-table')

const Command = require('../../utils/command')
const { error, exit, log, logJson, warn } = require('../../utils/command-helpers')
const { getFunctionsDir } = require('../../utils/functions')
const { getFunctions } = require('../../utils/get-functions')

class FunctionsListCommand extends Command {
  async run() {
    const { flags } = this.parse(FunctionsListCommand)

    const { api, config, site } = this.netlify

    // get deployed site details
    // copied from `netlify status`
    const siteId = site.id
    if (!siteId) {
      warn('Did you run `netlify link` yet?')
      error(`You don't appear to be in a folder that is linked to a site`)
    }
    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (error_) {
      // unauthorized
      if (error_.status === 401) {
        warn(`Log in with a different account or re-link to a site you have permission for`)
        error(`Not authorized to view the currently linked site (${siteId})`)
      }
      // missing
      if (error_.status === 404) {
        error(`The site this folder is linked to can't be found`)
      }
      error(error_)
    }
    const deploy = siteData.published_deploy || {}
    const deployedFunctions = deploy.available_functions || []

    const functionsDir = getFunctionsDir({ flags, config })

    if (typeof functionsDir === 'undefined') {
      log('Functions directory is undefined')
      log('Please verify functions.directory is set in your Netlify configuration file (netlify.toml/yml/json)')
      log('See https://docs.netlify.com/configure-builds/file-based-configuration/ for more information')
      process.exit(1)
    }

    const functions = await getFunctions(functionsDir)
    const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions))

    if (normalizedFunctions.length === 0) {
      log(`No functions found in ${functionsDir}`)
      exit()
    }

    if (flags.json) {
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
}

const normalizeFunction = function (deployedFunctions, { name, urlPath: url }) {
  const isDeployed = deployedFunctions.some((deployedFunction) => deployedFunction.n === name)
  return { name, url, isDeployed }
}

FunctionsListCommand.description = `List functions that exist locally

Helpful for making sure that you have formatted your functions correctly

NOT the same as listing the functions that have been deployed. For that info you need to go to your Netlify deploy log.
`
FunctionsListCommand.aliases = ['function:list']
FunctionsListCommand.flags = {
  name: flagsLib.string({
    char: 'n',
    description: 'name to print',
  }),
  functions: flagsLib.string({
    char: 'f',
    description: 'Specify a functions directory to list',
  }),
  json: flagsLib.boolean({
    description: 'Output function data as JSON',
  }),
  ...FunctionsListCommand.flags,
}

module.exports = FunctionsListCommand
