const process = require('process')

const { flags: flagsLib } = require('@oclif/command')
const AsciiTable = require('ascii-table')

const Command = require('../../utils/command')
const { getFunctions } = require('../../utils/get-functions')

class FunctionsListCommand extends Command {
  async run() {
    const { flags } = this.parse(FunctionsListCommand)
    const { api, site, config } = this.netlify

    // get deployed site details
    // copied from `netlify status`
    const siteId = site.id
    if (!siteId) {
      this.warn('Did you run `netlify link` yet?')
      this.error(`You don't appear to be in a folder that is linked to a site`)
    }
    let siteData
    try {
      siteData = await api.getSite({ siteId })
    } catch (error) {
      // unauthorized
      if (error.status === 401) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      // missing
      if (error.status === 404) {
        this.error(`The site this folder is linked to can't be found`)
      }
      this.error(error)
    }
    const deploy = siteData.published_deploy || {}
    const deployedFunctions = deploy.available_functions || []

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions:list',
      },
    })

    const functionsDir =
      flags.functions ||
      (config.dev && config.dev.functions) ||
      (config.build && config.build.functions) ||
      flags.Functions ||
      (config.dev && config.dev.Functions) ||
      (config.build && config.build.Functions)

    if (typeof functionsDir === 'undefined') {
      this.log('Functions directory is undefined')
      this.log('Please verify build.functions is set in your Netlify configuration file (netlify.toml/yml/json)')
      this.log('See https://docs.netlify.com/configure-builds/file-based-configuration/ for more information')
      process.exit(1)
    }

    const functions = await getFunctions(functionsDir)
    const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions))

    if (normalizedFunctions.length === 0) {
      this.log(`No functions found in ${functionsDir}`)
      this.exit()
    }

    if (flags.json) {
      this.logJson(normalizedFunctions)
      this.exit()
    }

    // Make table
    this.log(`Based on local functions folder ${functionsDir}, these are the functions detected`)
    const table = new AsciiTable(`Netlify Functions (in local functions folder)`)
    table.setHeading('Name', 'URL', 'deployed')
    normalizedFunctions.forEach(({ name, url, isDeployed }) => {
      table.addRow(name, url, isDeployed ? 'yes' : 'no')
    })
    this.log(table.toString())
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
    description: 'Specify a functions folder to serve',
  }),
  json: flagsLib.boolean({
    description: 'Output function data as JSON',
  }),
  ...FunctionsListCommand.flags,
}

// TODO make visible once implementation complete
FunctionsListCommand.hidden = true

module.exports = FunctionsListCommand
