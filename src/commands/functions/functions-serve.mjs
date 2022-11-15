// @ts-check
import { join } from 'path'

import { startFunctionsServer } from '../../lib/functions/server.cjs'
import utils from '../../utils/index.cjs'

const { acquirePort, getFunctionsDir, getSiteInformation, injectEnvVariables } = utils
const DEFAULT_PORT = 9999

/**
 * The functions:serve command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const functionsServe = async (options, command) => {
  const { api, config, site, siteInfo } = command.netlify

  const functionsDir = getFunctionsDir({ options, config }, join('netlify', 'functions'))

  await injectEnvVariables({ devConfig: { ...config.dev }, env: command.netlify.cachedConfig.env, site })

  const { capabilities, siteUrl, timeouts } = await getSiteInformation({
    offline: options.offline,
    api,
    site,
    siteInfo,
  })

  const functionsPort = await acquirePort({
    configuredPort: options.port || (config.dev && config.dev.functionsPort),
    defaultPort: DEFAULT_PORT,
    errorMessage: 'Could not acquire configured functions port',
  })

  await startFunctionsServer({
    config,
    api,
    settings: { functions: functionsDir, functionsPort },
    site,
    siteInfo,
    siteUrl,
    capabilities,
    timeouts,
    functionsPrefix: '/.netlify/functions/',
    buildersPrefix: '/.netlify/builders/',
  })
}

/**
 * Creates the `netlify functions:serve` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsServeCommand = (program) =>
  program
    .command('functions:serve')
    .alias('function:serve')
    .description('(Beta) Serve functions locally')
    .option('-f, --functions <dir>', 'Specify a functions directory to serve')
    .option('-p, --port <port>', 'Specify a port for the functions server', (value) => Number.parseInt(value))
    .option('-o, --offline', 'disables any features that require network access')
    .addHelpText('after', 'Helpful for debugging functions.')
    .action(functionsServe)
