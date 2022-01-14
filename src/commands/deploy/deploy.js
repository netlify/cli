// @ts-check
const { stat } = require('fs').promises
const { basename, resolve } = require('path')
const { cwd, env } = require('process')

const { get } = require('dot-prop')
const inquirer = require('inquirer')
const isObject = require('lodash/isObject')
const prettyjson = require('prettyjson')

const netlifyConfigPromise = import('@netlify/config')

const { cancelDeploy } = require('../../lib/api')
const { getBuildOptions, runBuild } = require('../../lib/build')
const { normalizeFunctionsConfig } = require('../../lib/functions/config')
const { getLogMessage } = require('../../lib/log')
const { startSpinner, stopSpinner } = require('../../lib/spinner')
const {
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  chalk,
  deployEdgeHandlers,
  deploySite,
  error,
  exit,
  getFunctionsManifestPath,
  getInternalFunctionsDir,
  getToken,
  log,
  logJson,
  openBrowser,
  warn,
} = require('../../utils')
const { link } = require('../link')
const { sitesCreate } = require('../sites')

const DEFAULT_DEPLOY_TIMEOUT = 1.2e6

const triggerDeploy = async ({ api, siteData, siteId }) => {
  try {
    const siteBuild = await api.createSiteBuild({ siteId })
    log(
      `${NETLIFYDEV} A new deployment was triggered successfully. Visit https://app.netlify.com/sites/${siteData.name}/deploys/${siteBuild.deploy_id} to see the logs.`,
    )
  } catch (error_) {
    if (error_.status === 404) {
      error('Site not found. Please rerun "netlify link" and make sure that your site has CI configured.')
    } else {
      error(error_.message)
    }
  }
}

/**
 * g
 * @param {object} config
 * @param {object} config.config
 * @param {import('commander').OptionValues} config.options
 * @param {object} config.site
 * @param {object} config.siteData
 * @returns {Promise<string>}
 */
const getDeployFolder = async ({ config, options, site, siteData }) => {
  let deployFolder
  if (options.dir) {
    deployFolder = resolve(cwd(), options.dir)
  } else if (get(config, 'build.publish')) {
    deployFolder = resolve(site.root, get(config, 'build.publish'))
  } else if (get(siteData, 'build_settings.dir')) {
    deployFolder = resolve(site.root, get(siteData, 'build_settings.dir'))
  }

  if (!deployFolder) {
    log('Please provide a publish directory (e.g. "public" or "dist" or "."):')
    log(cwd())
    const { promptPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'promptPath',
        message: 'Publish directory',
        default: '.',
        filter: (input) => resolve(cwd(), input),
      },
    ])
    deployFolder = promptPath
  }

  return deployFolder
}

const validateDeployFolder = async ({ deployFolder }) => {
  /** @type {import('fs').Stats} */
  let stats
  try {
    stats = await stat(deployFolder)
  } catch (error_) {
    if (error_.code === 'ENOENT') {
      return error(`No such directory ${deployFolder}! Did you forget to run a build?`)
    }

    // Improve the message of permission errors
    if (error_.code === 'EACCES') {
      return error('Permission error when trying to access deploy folder')
    }
    throw error_
  }

  if (!stats.isDirectory()) {
    return error('Deploy target must be a path to a directory')
  }
  return stats
}

/**
 * get the functions directory
 * @param {object} config
 * @param {object} config.config
 * @param {import('commander').OptionValues} config.options
 * @param {object} config.site
 * @param {object} config.siteData
 * @returns {string}
 */
const getFunctionsFolder = ({ config, options, site, siteData }) => {
  let functionsFolder
  // Support "functions" and "Functions"
  const funcConfig = config.functionsDirectory
  if (options.functions) {
    functionsFolder = resolve(cwd(), options.functions)
  } else if (funcConfig) {
    functionsFolder = resolve(site.root, funcConfig)
  } else if (get(siteData, 'build_settings.functions_dir')) {
    functionsFolder = resolve(site.root, get(siteData, 'build_settings.functions_dir'))
  }
  return functionsFolder
}

const validateFunctionsFolder = async ({ functionsFolder }) => {
  /** @type {import('fs').Stats} */
  let stats
  if (functionsFolder) {
    // we used to hard error if functions folder is specified but doesn't exist
    // but this was too strict for onboarding. we can just log a warning.
    try {
      stats = await stat(functionsFolder)
    } catch (error_) {
      if (error_.code === 'ENOENT') {
        log(
          `Functions folder "${functionsFolder}" specified but it doesn't exist! Will proceed without deploying functions`,
        )
      }
      // Improve the message of permission errors
      if (error_.code === 'EACCES') {
        error('Permission error when trying to access functions folder')
      }
    }
  }

  if (stats && !stats.isDirectory()) {
    error('Functions folder must be a path to a directory')
  }

  return stats
}

const validateFolders = async ({ deployFolder, functionsFolder }) => {
  const deployFolderStat = await validateDeployFolder({ deployFolder })
  const functionsFolderStat = await validateFunctionsFolder({ functionsFolder })
  return { deployFolderStat, functionsFolderStat }
}

const getDeployFilesFilter = ({ deployFolder, site }) => {
  // site.root === deployFolder can happen when users run `netlify deploy --dir .`
  // in that specific case we don't want to publish the repo node_modules
  // when site.root !== deployFolder the behaviour matches our buildbot
  const skipNodeModules = site.root === deployFolder

  return (filename) => {
    if (filename == null) {
      return false
    }
    if (filename === deployFolder) {
      return true
    }

    const base = basename(filename)
    const skipFile =
      (skipNodeModules && base === 'node_modules') ||
      (base.startsWith('.') && base !== '.well-known') ||
      base.startsWith('__MACOSX') ||
      base.includes('/.')

    return !skipFile
  }
}

const SEC_TO_MILLISEC = 1e3
// 100 bytes
const SYNC_FILE_LIMIT = 1e2

const prepareProductionDeploy = async ({ api, siteData }) => {
  if (isObject(siteData.published_deploy) && siteData.published_deploy.locked) {
    log(`\n${NETLIFYDEVERR} Deployments are "locked" for production context of this site\n`)
    const { unlockChoice } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'unlockChoice',
        message: 'Would you like to "unlock" deployments for production context to proceed?',
        default: false,
      },
    ])
    if (!unlockChoice) exit(0)
    await api.unlockDeploy({ deploy_id: siteData.published_deploy.id })
    log(`\n${NETLIFYDEVLOG} "Auto publishing" has been enabled for production context\n`)
  }
  log('Deploying to main site URL...')
}

const hasErrorMessage = (actual, expected) => {
  if (typeof actual === 'string') {
    return actual.includes(expected)
  }
  return false
}

const getJsonErrorMessage = (error_) => get(error_, 'json.message', '')

const reportDeployError = ({ error_, failAndExit }) => {
  switch (true) {
    case error_.name === 'JSONHTTPError': {
      const message = getJsonErrorMessage(error)
      if (hasErrorMessage(message, 'Background Functions not allowed by team plan')) {
        return failAndExit(`\n${getLogMessage('functions.backgroundNotSupported')}`)
      }
      warn(`JSONHTTPError: ${message} ${error_.status}`)
      warn(`\n${JSON.stringify(error_, null, '  ')}\n`)
      failAndExit(error_)
      return
    }
    case error_.name === 'TextHTTPError': {
      warn(`TextHTTPError: ${error_.status}`)
      warn(`\n${error_}\n`)
      failAndExit(error_)
      return
    }
    case hasErrorMessage(error_.message, 'Invalid filename'): {
      warn(error_.message)
      failAndExit(error_)
      return
    }
    default: {
      warn(`\n${JSON.stringify(error_, null, '  ')}\n`)
      failAndExit(error_)
    }
  }
}

const deployProgressCb = function () {
  /**
   * @type {Record<string, import('ora').Ora>}
   */
  const events = {}
  return (event) => {
    switch (event.phase) {
      case 'start': {
        events[event.type] = startSpinner({
          text: event.msg,
        })
        return
      }
      case 'progress': {
        const spinner = events[event.type]
        if (spinner) {
          spinner.text = event.msg
        }
        return
      }
      case 'stop':
      default: {
        stopSpinner({ spinner: events[event.type], text: event.msg })
        delete events[event.type]
      }
    }
  }
}

const runDeploy = async ({
  alias,
  api,
  configPath,
  deployFolder,
  deployTimeout,
  deployToProduction,
  functionsConfig,
  functionsFolder,
  silent,
  site,
  siteData,
  siteId,
  skipFunctionsCache,
  title,
}) => {
  let results
  let deployId
  try {
    if (deployToProduction) {
      await prepareProductionDeploy({ siteData, api })
    } else {
      log('Deploying to draft URL...')
    }

    const draft = !deployToProduction && !alias
    results = await api.createSiteDeploy({ siteId, title, body: { draft, branch: alias } })
    deployId = results.id

    await deployEdgeHandlers({
      site,
      deployId,
      api,
      silent,
    })
    const internalFunctionsFolder = await getInternalFunctionsDir({ base: site.root })

    // The order of the directories matter: zip-it-and-ship-it will prioritize
    // functions from the rightmost directories. In this case, we want user
    // functions to take precedence over internal functions.
    const functionDirectories = [internalFunctionsFolder, functionsFolder].filter(Boolean)
    const manifestPath = skipFunctionsCache ? null : await getFunctionsManifestPath({ base: site.root })

    // @ts-ignore
    results = await deploySite(api, siteId, deployFolder, {
      configPath,
      fnDir: functionDirectories,
      functionsConfig,
      statusCb: silent ? () => {} : deployProgressCb(),
      deployTimeout,
      syncFileLimit: SYNC_FILE_LIMIT,
      // pass an existing deployId to update
      deployId,
      filter: getDeployFilesFilter({ site, deployFolder }),
      rootDir: site.root,
      manifestPath,
      skipFunctionsCache,
    })
  } catch (error_) {
    if (deployId) {
      await cancelDeploy({ api, deployId })
    }
    reportDeployError({ error_, failAndExit: error })
  }

  const siteUrl = results.deploy.ssl_url || results.deploy.url
  const deployUrl = get(results, 'deploy.deploy_ssl_url') || get(results, 'deploy.deploy_url')
  const logsUrl = `${get(results, 'deploy.admin_url')}/deploys/${get(results, 'deploy.id')}`

  return {
    siteId: results.deploy.site_id,
    siteName: results.deploy.name,
    deployId: results.deployId,
    siteUrl,
    deployUrl,
    logsUrl,
  }
}

/**
 *
 * @param {object} config
 * @param {*} config.cachedConfig
 * @param {import('commander').OptionValues} config.options The options of the command
 * @returns
 */
const handleBuild = async ({ cachedConfig, options }) => {
  if (!options.build) {
    return {}
  }
  const [token] = await getToken()
  const resolvedOptions = await getBuildOptions({
    cachedConfig,
    token,
    options,
  })
  const { configMutations, exitCode, newConfig } = await runBuild(resolvedOptions)
  if (exitCode !== 0) {
    exit(exitCode)
  }
  return { newConfig, configMutations }
}

/**
 *
 * @param {object} config
 * @param {boolean} config.deployToProduction
 * @param {boolean} config.json If the result should be printed as json message
 * @param {boolean} config.runBuildCommand If the build command should be run
 * @param {object} config.results
 * @returns {void}
 */
const printResults = ({ deployToProduction, json, results, runBuildCommand }) => {
  const msgData = {
    Logs: `${results.logsUrl}`,
    'Unique Deploy URL': results.deployUrl,
  }

  if (deployToProduction) {
    msgData['Website URL'] = results.siteUrl
  } else {
    delete msgData['Unique Deploy URL']
    msgData['Website Draft URL'] = results.deployUrl
  }

  // Spacer
  log()

  // Json response for piping commands
  if (json) {
    const jsonData = {
      name: results.name,
      site_id: results.site_id,
      site_name: results.siteName,
      deploy_id: results.deployId,
      deploy_url: results.deployUrl,
      logs: results.logsUrl,
    }
    if (deployToProduction) {
      jsonData.url = results.siteUrl
    }

    logJson(jsonData)
    exit(0)
  } else {
    log(prettyjson.render(msgData))

    if (!deployToProduction) {
      log()
      log('If everything looks good on your draft URL, deploy it to your main site URL with the --prod flag.')
      log(`${chalk.cyanBright.bold(`netlify deploy${runBuildCommand ? ' --build' : ''} --prod`)}`)
      log()
    }
  }
}

/**
 * The deploy command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const deploy = async (options, command) => {
  const { api, site } = command.netlify
  const alias = options.alias || options.branch

  command.setAnalyticsPayload({ open: options.open, prod: options.prod, json: options.json, alias: Boolean(alias) })

  if (options.branch) {
    warn('--branch flag has been renamed to --alias and will be removed in future versions')
  }

  if (options.context && !options.build) {
    return error('--context flag is only available when using the --build flag')
  }

  await command.authenticate(options.auth)

  let siteId = options.site || site.id
  let siteData = {}
  if (siteId) {
    try {
      siteData = await api.getSite({ siteId })
    } catch (error_) {
      // TODO specifically handle known cases (e.g. no account access)
      if (error_.status === 404) {
        error('Site not found')
      } else {
        error(error_.message)
      }
    }
  } else {
    log("This folder isn't linked to a site yet")
    const NEW_SITE = '+  Create & configure a new site'
    const EXISTING_SITE = 'Link this directory to an existing site'

    const initializeOpts = [EXISTING_SITE, NEW_SITE]

    const { initChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'initChoice',
        message: 'What would you like to do?',
        choices: initializeOpts,
      },
    ])
    // create site or search for one
    if (initChoice === NEW_SITE) {
      siteData = await sitesCreate({}, command)
      site.id = siteData.id
      siteId = site.id
    } else if (initChoice === EXISTING_SITE) {
      siteData = await link({}, command)
      site.id = siteData.id
      siteId = site.id
    }
  }

  const deployToProduction = options.prod || (options.prodIfUnlocked && !siteData.published_deploy.locked)

  if (options.trigger) {
    return triggerDeploy({ api, siteId, siteData })
  }

  const { newConfig, configMutations = [] } = await handleBuild({
    cachedConfig: command.netlify.cachedConfig,
    options,
  })
  const config = newConfig || command.netlify.config

  const deployFolder = await getDeployFolder({ options, config, site, siteData })
  const functionsFolder = getFunctionsFolder({ options, config, site, siteData })
  const { configPath } = site

  log(
    prettyjson.render({
      'Deploy path': deployFolder,
      'Functions path': functionsFolder,
      'Configuration path': configPath,
    }),
  )

  const { functionsFolderStat } = await validateFolders({
    deployFolder,
    functionsFolder,
  })
  const functionsConfig = normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot: site.root })

  const redirectsPath = `${deployFolder}/_redirects`
  const { restoreConfig, updateConfig } = await netlifyConfigPromise
  // @ts-ignore
  await updateConfig(configMutations, {
    buildDir: deployFolder,
    configPath,
    redirectsPath,
    context: command.netlify.cachedConfig.context,
    branch: command.netlify.cachedConfig.branch,
  })
  const results = await runDeploy({
    alias,
    api,
    configPath,
    deployFolder,
    deployTimeout: options.timeout * SEC_TO_MILLISEC || DEFAULT_DEPLOY_TIMEOUT,
    deployToProduction,
    functionsConfig,
    // pass undefined functionsFolder if doesn't exist
    functionsFolder: functionsFolderStat && functionsFolder,
    silent: options.json || options.silent,
    site,
    siteData,
    siteId,
    skipFunctionsCache: options.skipFunctionsCache,
    title: options.message,
  })

  // @ts-ignore
  await restoreConfig(configMutations, { buildDir: deployFolder, configPath, redirectsPath })

  printResults({
    runBuildCommand: options.build,
    json: options.json,
    results,
    deployToProduction,
  })

  if (options.open) {
    const urlToOpen = deployToProduction ? results.siteUrl : results.deployUrl
    await openBrowser({ url: urlToOpen })
    exit()
  }
}

/**
 * Creates the `netlify deploy` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createDeployCommand = (program) =>
  program
    .command('deploy')
    .description(
      `Create a new deploy from the contents of a folder
Deploys from the build settings found in the netlify.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- \`NETLIFY_AUTH_TOKEN\` - an access token to use when authenticating commands. Keep this value private.
- \`NETLIFY_SITE_ID\` - override any linked site in the current working directory.

Lambda functions in the function folder can be in the following configurations for deployment:


Built Go binaries:
------------------

\`\`\`
functions/
└── nameOfGoFunction
\`\`\`

Build binaries of your Go language functions into the functions folder as part of your build process.


Single file Node.js functions:
-----------------------------

Build dependency bundled Node.js lambda functions with tools like netlify-lambda, webpack or browserify into the function folder as part of your build process.

\`\`\`
functions/
└── nameOfBundledNodeJSFunction.js
\`\`\`

Unbundled Node.js functions that have dependencies outside or inside of the functions folder:
---------------------------------------------------------------------------------------------

You can ship unbundled Node.js functions with the CLI, utilizing top level project dependencies, or a nested package.json.
If you use nested dependencies, be sure to populate the nested node_modules as part of your build process before deploying using npm or yarn.

\`\`\`
project/
├── functions
│   ├── functionName/
│   │   ├── functionName.js  (Note the folder and the function name need to match)
│   │   ├── package.json
│   │   └── node_modules/
│   └── unbundledFunction.js
├── package.json
├── netlify.toml
└── node_modules/
\`\`\`

Any mix of these configurations works as well.


Node.js function entry points
-----------------------------

Function entry points are determined by the file name and name of the folder they are in:

\`\`\`
functions/
├── aFolderlessFunctionEntrypoint.js
└── functionName/
  ├── notTheEntryPoint.js
  └── functionName.js
\`\`\`

Support for package.json's main field, and intrinsic index.js entrypoints are coming soon.`,
    )
    .option('-d, --dir <path>', 'Specify a folder to deploy')
    .option('-f, --functions <folder>', 'Specify a functions folder to deploy')
    .option('-p, --prod', 'Deploy to production', false)
    .option('--prodIfUnlocked', 'Deploy to production if unlocked, create a draft otherwise', false)
    .option(
      '--alias <name>',
      'Specifies the alias for deployment, the string at the beginning of the deploy subdomain. Useful for creating predictable deployment URLs. Avoid setting an alias string to the same value as a deployed branch. `alias` doesn’t create a branch deploy and can’t be used in conjunction with the branch subdomain feature. Maximum 37 characters.',
    )
    .option(
      '-b, --branch <name>',
      'Serves the same functionality as --alias. Deprecated and will be removed in future versions',
    )
    .option('-o, --open', 'Open site after deploy', false)
    .option('-m, --message <message>', 'A short message to include in the deploy log')
    .option('-a, --auth <token>', 'Netlify auth token to deploy with', env.NETLIFY_AUTH_TOKEN)
    .option('-s, --site <id>', 'A site ID to deploy to', env.NETLIFY_SITE_ID)
    .option('--json', 'Output deployment data as JSON')
    .option('--timeout <number>', 'Timeout to wait for deployment to finish', (value) => Number.parseInt(value))
    .option('--trigger', 'Trigger a new build of your site on Netlify without uploading local files')
    .option('--build', 'Run build command before deploying')
    .option('--context <context>', 'Context to use when resolving build configuration')
    .option(
      '--skip-functions-cache',
      'Ignore any functions created as part of a previous `build` or `deploy` commands, forcing them to be bundled again as part of the deployment',
      false,
    )
    .addExamples([
      'netlify deploy',
      'netlify deploy --prod',
      'netlify deploy --prod --open',
      'netlify deploy --prodIfUnlocked',
      'netlify deploy --message "A message with an $ENV_VAR"',
      'netlify deploy --auth $NETLIFY_AUTH_TOKEN',
      'netlify deploy --trigger',
      'netlify deploy --build --context deploy-preview',
    ])
    .action(deploy)

module.exports = { createDeployCommand }
