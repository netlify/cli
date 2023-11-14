// @ts-check
import { stat } from 'fs/promises'
import { basename, resolve } from 'path'
import { env } from 'process'

import { runCoreSteps } from '@netlify/build'
import { Option } from 'commander'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'
import isObject from 'lodash/isObject.js'
import { parseAllHeaders } from 'netlify-headers-parser'
import { parseAllRedirects } from 'netlify-redirect-parser'
import prettyjson from 'prettyjson'

import { cancelDeploy } from '../../lib/api.mjs'
import { getBuildOptions, runBuild } from '../../lib/build.mjs'
import { getBootstrapURL } from '../../lib/edge-functions/bootstrap.mjs'
import { featureFlags as edgeFunctionsFeatureFlags } from '../../lib/edge-functions/consts.mjs'
import { normalizeFunctionsConfig } from '../../lib/functions/config.mjs'
import { BACKGROUND_FUNCTIONS_WARNING } from '../../lib/log.mjs'
import { startSpinner, stopSpinner } from '../../lib/spinner.mjs'
import {
  chalk,
  error,
  exit,
  getToken,
  log,
  logJson,
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  warn,
} from '../../utils/command-helpers.mjs'
import { DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.mjs'
import { deploySite } from '../../utils/deploy/deploy-site.mjs'
import { getEnvelopeEnv } from '../../utils/env/index.mjs'
import { getFunctionsManifestPath, getInternalFunctionsDir } from '../../utils/functions/index.mjs'
import openBrowser from '../../utils/open-browser.mjs'
import { link } from '../link/index.mjs'
import { sitesCreate } from '../sites/index.mjs'

const triggerDeploy = async ({ api, options, siteData, siteId }) => {
  try {
    const siteBuild = await api.createSiteBuild({ siteId })
    if (options.json) {
      logJson({
        site_id: siteId,
        site_name: siteData.name,
        deploy_id: `${siteBuild.deploy_id}`,
        logs: `https://app.netlify.com/sites/${siteData.name}/deploys/${siteBuild.deploy_id}`,
      })
    } else {
      log(
        `${NETLIFYDEV} A new deployment was triggered successfully. Visit https://app.netlify.com/sites/${siteData.name}/deploys/${siteBuild.deploy_id} to see the logs.`,
      )
    }
  } catch (error_) {
    if (error_.status === 404) {
      error('Site not found. Please rerun "netlify link" and make sure that your site has CI configured.')
    } else {
      error(error_.message)
    }
  }
}

/**
 * Retrieves the folder containing the static files that need to be deployed
 * @param {object} config
 * @param {import('../base-command.mjs').default} config.command The process working directory
 * @param {object} config.config
 * @param {import('commander').OptionValues} config.options
 * @param {object} config.site
 * @param {object} config.siteData
 * @returns {Promise<string>}
 */
const getDeployFolder = async ({ command, config, options, site, siteData }) => {
  let deployFolder
  // if the `--dir .` flag is provided we should resolve it to the working directory.
  // - in regular sites this is the `process.cwd`
  // - in mono repositories this will be the root of the jsWorkspace
  if (options.dir) {
    deployFolder = command.workspacePackage
      ? resolve(command.jsWorkspaceRoot || site.root, options.dir)
      : resolve(command.workingDir, options.dir)
  } else if (config?.build?.publish) {
    deployFolder = resolve(site.root, config.build.publish)
  } else if (siteData?.build_settings?.dir) {
    deployFolder = resolve(site.root, siteData.build_settings.dir)
  }

  if (!deployFolder) {
    log('Please provide a publish directory (e.g. "public" or "dist" or "."):')
    const { promptPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'promptPath',
        message: 'Publish directory',
        default: '.',
        filter: (input) => resolve(command.workingDir, input),
      },
    ])
    deployFolder = promptPath
  }

  return deployFolder
}

/**
 * @param {string} deployFolder
 */
const validateDeployFolder = async (deployFolder) => {
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
 * @param {string} config.workingDir // The process working directory
 * @returns {string|undefined}
 */
const getFunctionsFolder = ({ config, options, site, siteData, workingDir }) => {
  let functionsFolder
  // Support "functions" and "Functions"
  const funcConfig = config.functionsDirectory
  if (options.functions) {
    functionsFolder = resolve(workingDir, options.functions)
  } else if (funcConfig) {
    functionsFolder = resolve(site.root, funcConfig)
  } else if (siteData?.build_settings?.functions_dir) {
    functionsFolder = resolve(site.root, siteData.build_settings.functions_dir)
  }
  return functionsFolder
}

/**
 *
 * @param {string|undefined} functionsFolder
 */
const validateFunctionsFolder = async (functionsFolder) => {
  /** @type {import('fs').Stats|undefined} */
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
  const deployFolderStat = await validateDeployFolder(deployFolder)
  const functionsFolderStat = await validateFunctionsFolder(functionsFolder)
  return { deployFolderStat, functionsFolderStat }
}

/**
 * @param {object} config
 * @param {string} config.deployFolder
 * @param {*} config.site
 * @returns
 */
const getDeployFilesFilter = ({ deployFolder, site }) => {
  // site.root === deployFolder can happen when users run `netlify deploy --dir .`
  // in that specific case we don't want to publish the repo node_modules
  // when site.root !== deployFolder the behaviour matches our buildbot
  const skipNodeModules = site.root === deployFolder

  /**
   * @param {string} filename
   */
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
      base.includes('/.') ||
      // headers and redirects are bundled in the config
      base === '_redirects' ||
      base === '_headers'

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

const reportDeployError = ({ error_, failAndExit }) => {
  switch (true) {
    case error_.name === 'JSONHTTPError': {
      const message = error_?.json?.message ?? ''
      if (hasErrorMessage(message, 'Background Functions not allowed by team plan')) {
        return failAndExit(`\n${BACKGROUND_FUNCTIONS_WARNING}`)
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
      case 'error':
        stopSpinner({ error: true, spinner: events[event.type], text: event.msg })
        delete events[event.type]
        return
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
  command,
  config,
  deployFolder,
  deployTimeout,
  deployToProduction,
  functionsConfig,
  functionsFolder,
  packagePath,
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

    const internalFunctionsFolder = await getInternalFunctionsDir({ base: site.root, packagePath })

    // The order of the directories matter: zip-it-and-ship-it will prioritize
    // functions from the rightmost directories. In this case, we want user
    // functions to take precedence over internal functions.
    const functionDirectories = [internalFunctionsFolder, functionsFolder].filter(Boolean)
    const manifestPath = skipFunctionsCache ? null : await getFunctionsManifestPath({ base: site.root, packagePath })

    const redirectsPath = `${deployFolder}/_redirects`
    const headersPath = `${deployFolder}/_headers`

    const { redirects } = await parseAllRedirects({
      configRedirects: config.redirects,
      redirectsFiles: [redirectsPath],
      minimal: true,
    })

    config.redirects = redirects

    const { headers } = await parseAllHeaders({
      configHeaders: config.headers,
      // @ts-ignore
      headersFiles: [headersPath],
      minimal: true,
    })

    config.headers = headers

    // @ts-ignore
    results = await deploySite(api, siteId, deployFolder, {
      config,
      fnDir: functionDirectories,
      functionsConfig,
      statusCb: silent ? () => {} : deployProgressCb(),
      deployTimeout,
      syncFileLimit: SYNC_FILE_LIMIT,
      // pass an existing deployId to update
      deployId,
      filter: getDeployFilesFilter({ site, deployFolder }),
      workingDir: command.workingDir,
      manifestPath,
      skipFunctionsCache,
      siteRoot: site.root,
    })
  } catch (error_) {
    if (deployId) {
      await cancelDeploy({ api, deployId })
    }
    reportDeployError({ error_, failAndExit: error })
  }

  const siteUrl = results.deploy.ssl_url || results.deploy.url
  const deployUrl = results.deploy.deploy_ssl_url || results.deploy.deploy_url
  const logsUrl = `${results.deploy.admin_url}/deploys/${results.deploy.id}`

  let functionLogsUrl = `${results.deploy.admin_url}/functions`

  if (!deployToProduction) {
    functionLogsUrl += `?scope=deploy:${deployId}`
  }

  return {
    siteId: results.deploy.site_id,
    siteName: results.deploy.name,
    deployId: results.deployId,
    siteUrl,
    deployUrl,
    logsUrl,
    functionLogsUrl,
  }
}

/**
 *
 * @param {object} config
 * @param {*} config.cachedConfig
 * @param {string} [config.packagePath]
 * @param {*} config.deployHandler
 * @param {string} config.currentDir
 * @param {import('commander').OptionValues} config.options The options of the command
 * @returns
 */
const handleBuild = async ({ cachedConfig, currentDir, deployHandler, options, packagePath }) => {
  if (!options.build) {
    return {}
  }
  const [token] = await getToken()
  const resolvedOptions = await getBuildOptions({
    cachedConfig,
    packagePath,
    token,
    options,
    currentDir,
    deployHandler,
  })
  const { configMutations, exitCode, newConfig } = await runBuild(resolvedOptions)
  if (exitCode !== 0) {
    exit(exitCode)
  }
  return { newConfig, configMutations }
}

/**
 *
 * @param {*} options Bundling options
 * @param {import('..//base-command.mjs').default} command
 * @returns
 */
const bundleEdgeFunctions = async (options, command) => {
  // eslint-disable-next-line n/prefer-global/process, unicorn/prefer-set-has
  const argv = process.argv.slice(2)
  const statusCb =
    options.silent || argv.includes('--json') || argv.includes('--silent') ? () => {} : deployProgressCb()

  statusCb({
    type: 'edge-functions-bundling',
    msg: 'Bundling edge functions...\n',
    phase: 'start',
  })

  const { severityCode, success } = await runCoreSteps(['edge_functions_bundling'], {
    ...options,
    packagePath: command.workspacePackage,
    buffer: true,
    featureFlags: edgeFunctionsFeatureFlags,
    edgeFunctionsBootstrapURL: getBootstrapURL(),
  })

  if (!success) {
    statusCb({
      type: 'edge-functions-bundling',
      msg: 'Deploy aborted due to error while bundling edge functions',
      phase: 'error',
    })

    exit(severityCode)
  }

  statusCb({
    type: 'edge-functions-bundling',
    msg: 'Finished bundling edge functions',
    phase: 'stop',
  })
}

/**
 *
 * @param {object} config
 * @param {boolean} config.deployToProduction
 * @param {boolean} config.isIntegrationDeploy If the user ran netlify integration:deploy instead of just netlify deploy
 * @param {boolean} config.json If the result should be printed as json message
 * @param {boolean} config.runBuildCommand If the build command should be run
 * @param {object} config.results
 * @returns {void}
 */
const printResults = ({ deployToProduction, isIntegrationDeploy, json, results, runBuildCommand }) => {
  const msgData = {
    'Build logs': results.logsUrl,
    'Function logs': results.functionLogsUrl,
  }

  if (deployToProduction) {
    msgData['Unique deploy URL'] = results.deployUrl
    msgData['Website URL'] = results.siteUrl
  } else {
    msgData['Website draft URL'] = results.deployUrl
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
      log(
        `${chalk.cyanBright.bold(
          `netlify ${isIntegrationDeploy ? 'integration:' : ''}deploy${runBuildCommand ? ' --build' : ''} --prod`,
        )}`,
      )
      log()
    }
  }
}

const prepAndRunDeploy = async ({
  api,
  command,
  config,
  deployToProduction,
  options,
  site,
  siteData,
  siteId,
  workingDir,
}) => {
  const alias = options.alias || options.branch
  const isUsingEnvelope = siteData && siteData.use_envelope
  // if a context is passed besides dev, we need to pull env vars from that specific context
  if (isUsingEnvelope && options.context && options.context !== 'dev') {
    command.netlify.cachedConfig.env = await getEnvelopeEnv({
      api,
      context: options.context,
      env: command.netlify.cachedConfig.env,
      siteInfo: siteData,
    })
  }

  const deployFolder = await getDeployFolder({ command, options, config, site, siteData })
  const functionsFolder = getFunctionsFolder({ workingDir, options, config, site, siteData })
  const { configPath } = site

  const edgeFunctionsConfig = command.netlify.config.edge_functions

  // build flag wasn't used and edge functions exist
  if (!options.build && edgeFunctionsConfig && edgeFunctionsConfig.length !== 0) {
    await bundleEdgeFunctions(options, command)
  }

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

  const siteEnv = isUsingEnvelope
    ? await getEnvelopeEnv({
        api,
        context: options.context,
        env: command.netlify.cachedConfig.env,
        raw: true,
        scope: 'functions',
        siteInfo: siteData,
      })
    : siteData?.build_settings?.env

  const functionsConfig = normalizeFunctionsConfig({
    functionsConfig: config.functions,
    projectRoot: site.root,
    siteEnv,
  })

  const results = await runDeploy({
    alias,
    api,
    command,
    config,
    deployFolder,
    deployTimeout: options.timeout * SEC_TO_MILLISEC || DEFAULT_DEPLOY_TIMEOUT,
    deployToProduction,
    functionsConfig,
    // pass undefined functionsFolder if doesn't exist
    functionsFolder: functionsFolderStat && functionsFolder,
    packagePath: command.workspacePackage,
    silent: options.json || options.silent,
    site,
    siteData,
    siteId,
    skipFunctionsCache: options.skipFunctionsCache,
    title: options.message,
  })

  return results
}

/**
 * The deploy command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const deploy = async (options, command) => {
  const { workingDir } = command
  const { api, site, siteInfo } = command.netlify
  const alias = options.alias || options.branch

  command.setAnalyticsPayload({ open: options.open, prod: options.prod, json: options.json, alias: Boolean(alias) })

  if (options.branch) {
    warn('--branch flag has been renamed to --alias and will be removed in future versions')
  }

  if (options.context && !options.build) {
    return error('--context flag is only available when using the --build flag')
  }

  await command.authenticate(options.auth)

  let siteId = site.id || options.site

  let siteData = {}
  if (siteId && !isEmpty(siteInfo)) {
    siteData = siteInfo
    siteId = siteData.id
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

  if (options.trigger) {
    return triggerDeploy({ api, options, siteData, siteId })
  }

  const deployToProduction = options.prod || (options.prodIfUnlocked && !siteData.published_deploy.locked)

  let results = {}

  if (options.build) {
    await handleBuild({
      packagePath: command.workspacePackage,
      cachedConfig: command.netlify.cachedConfig,
      currentDir: command.workingDir,
      options,
      deployHandler: async ({ netlifyConfig }) => {
        results = await prepAndRunDeploy({
          command,
          options,
          workingDir,
          api,
          site,
          config: netlifyConfig,
          siteData,
          siteId,
          deployToProduction,
        })

        return {}
      },
    })
  } else {
    results = await prepAndRunDeploy({
      command,
      options,
      workingDir,
      api,
      site,
      config: command.netlify.config,
      siteData,
      siteId,
      deployToProduction,
    })
  }
  const isIntegrationDeploy = command.name() === 'integration:deploy'

  printResults({
    runBuildCommand: options.build,
    isIntegrationDeploy,
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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDeployCommand = (program) =>
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
    .addOption(
      new Option(
        '--prodIfUnlocked',
        'Old, prefer --prod-if-unlocked. Deploy to production if unlocked, create a draft otherwise',
      )
        .default(false)
        .hideHelp(true),
    )
    .option('--prod-if-unlocked', 'Deploy to production if unlocked, create a draft otherwise', false)
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
    .option('-s, --site <name-or-id>', 'A site name or ID to deploy to', env.NETLIFY_SITE_ID)
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
      'netlify deploy --site my-first-site',
      'netlify deploy --prod',
      'netlify deploy --prod --open',
      'netlify deploy --prod-if-unlocked',
      'netlify deploy --message "A message with an $ENV_VAR"',
      'netlify deploy --auth $NETLIFY_AUTH_TOKEN',
      'netlify deploy --trigger',
      'netlify deploy --build --context deploy-preview',
    ])
    .action(deploy)
