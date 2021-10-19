const { join } = require('path')

const { flags: flagsLib } = require('@oclif/command')

const { startFunctionsServer } = require('../../lib/functions/server')
const Command = require('../../utils/command')
const { acquirePort, getSiteInformation, injectEnvVariables } = require('../../utils/dev')
const { getFunctionsDir } = require('../../utils/functions')

const DEFAULT_PORT = 9999

class FunctionsServeCommand extends Command {
  async run() {
    const { flags } = this.parse(FunctionsServeCommand)

    const { netlify } = this
    const { api, config, site, siteInfo } = netlify

    const functionsDir = getFunctionsDir({ flags, config }, join('netlify', 'functions'))

    await injectEnvVariables({ env: this.netlify.cachedConfig.env, site })

    const { capabilities, siteUrl, timeouts } = await getSiteInformation({
      flags,
      api,
      site,
      siteInfo,
    })

    const functionsPort = await acquirePort({
      configuredPort: flags.port || (config.dev && config.dev.functionsPort),
      defaultPort: DEFAULT_PORT,
      errorMessage: 'Could not acquire configured functions port',
    })

    await startFunctionsServer({
      config,
      settings: { functions: functionsDir, functionsPort },
      site,
      siteUrl,
      capabilities,
      timeouts,
      functionsPrefix: '/.netlify/functions/',
      buildersPrefix: '/.netlify/builders/',
    })
  }
}

FunctionsServeCommand.description = `(Beta) Serve functions locally

Helpful for debugging functions.
`
FunctionsServeCommand.aliases = ['function:serve']
FunctionsServeCommand.flags = {
  functions: flagsLib.string({
    char: 'f',
    description: 'Specify a functions directory to serve',
  }),
  port: flagsLib.integer({
    char: 'p',
    description: 'Specify a port for the functions server',
  }),
  offline: flagsLib.boolean({
    char: 'o',
    description: 'disables any features that require network access',
  }),
  ...FunctionsServeCommand.flags,
}

module.exports = FunctionsServeCommand
