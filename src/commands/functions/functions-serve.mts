// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startFunct... Remove this comment to see the full error message
const { startFunctionsServer } = require('../../lib/functions/server.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'acquirePor... Remove this comment to see the full error message
const { acquirePort, getFunctionsDir, getSiteInformation, injectEnvVariables } = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_PO... Remove this comment to see the full error message
const DEFAULT_PORT = 9999

/**
 * The functions:serve command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const functionsServe = async (options: $TSFixMe, command: $TSFixMe) => {
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const createFunctionsServeCommand = (program: $TSFixMe) => program
  .command('functions:serve')
  .alias('function:serve')
  .description('(Beta) Serve functions locally')
  .option('-f, --functions <dir>', 'Specify a functions directory to serve')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .option('-p, --port <port>', 'Specify a port for the functions server', (value: $TSFixMe) => Number.parseInt(value))
  .option('-o, --offline', 'disables any features that require network access')
  .addHelpText('after', 'Helpful for debugging functions.')
  .action(functionsServe)

module.exports = { createFunctionsServeCommand }
