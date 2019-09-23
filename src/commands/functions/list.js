const Command = require('../../utils/command')
const { flags } = require('@oclif/command')
const AsciiTable = require('ascii-table')
const { getFunctions } = require('../../utils/get-functions')
class FunctionsListCommand extends Command {
  async run() {
    let { flags } = this.parse(FunctionsListCommand)
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
    } catch (e) {
      if (e.status === 401 /* unauthorized*/) {
        this.warn(`Log in with a different account or re-link to a site you have permission for`)
        this.error(`Not authorized to view the currently linked site (${siteId})`)
      }
      if (e.status === 404 /* missing */) {
        this.error(`The site this folder is linked to can't be found`)
      }
      this.error(e)
    }
    const deploy = siteData.published_deploy || {}
    const deployed_functions = deploy.available_functions || []

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions:list'
      }
    })

    const functionsDir =
      flags.functions ||
      (config.dev && config.dev.functions) ||
      (config.build && config.build.functions) ||
      flags.Functions ||
      (config.dev && config.dev.Functions) ||
      (config.build && config.build.Functions)
    if (typeof functionsDir === 'undefined') {
      this.error('functions directory is undefined, did you forget to set it in netlify.toml?')
      process.exit(1)
    }
    var table = new AsciiTable(`Netlify Functions (based on local functions folder "${functionsDir}")`)
    const functions = getFunctions(functionsDir)

    table.setHeading('Name', 'Url', 'moduleDir', 'deployed')
    Object.entries(functions).forEach(([functionName, { moduleDir }]) => {
      const isDeployed = deployed_functions.map(({ n }) => n).includes(functionName)

      // this.log(`${chalk.yellow("function name")}: ${functionName}`);
      // this.log(
      //   `          ${chalk.yellow(
      //     "url"
      //   )}: ${`/.netlify/functions/${functionName}`}`
      // );
      // this.log(`    ${chalk.yellow("moduleDir")}: ${moduleDir}`);
      // this.log(
      //   `     ${chalk.yellow("deployed")}: ${
      //     isDeployed ? chalk.green("yes") : chalk.yellow("no")
      //   }`
      // );
      // this.log("----------");
      table.addRow(functionName, `/.netlify/functions/${functionName}`, moduleDir, isDeployed ? 'yes' : 'no')
    })
    this.log(table.toString())
  }
}

FunctionsListCommand.description = `list functions that exist locally

Helpful for making sure that you have formatted your functions correctly

NOT the same as listing the functions that have been deployed. For that info you need to go to your Netlify deploy log.
`
FunctionsListCommand.aliases = ['function:list']
FunctionsListCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'name to print'
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to serve'
  })
}

// TODO make visible once implementation complete
FunctionsListCommand.hidden = true

module.exports = FunctionsListCommand
