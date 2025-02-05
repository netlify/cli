import { type Stats } from 'fs'
import { stat } from 'fs/promises'
import { basename, resolve } from 'path'

import { type NetlifyConfig, runCoreSteps } from '@netlify/build'
import { type OptionValues } from 'commander'
import inquirer from 'inquirer'
import isEmpty from 'lodash/isEmpty.js'
import isObject from 'lodash/isObject.js'
import { parseAllHeaders } from '@netlify/headers-parser'
import { parseAllRedirects } from '@netlify/redirect-parser'
import prettyjson from 'prettyjson'

import { cancelDeploy } from '../../lib/api.js'
import { getBuildOptions, runBuild } from '../../lib/build.js'
import { getBootstrapURL } from '../../lib/edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from '../../lib/edge-functions/consts.js'
import { normalizeFunctionsConfig } from '../../lib/functions/config.js'
import { BACKGROUND_FUNCTIONS_WARNING } from '../../lib/log.js'
import { type Spinner, startSpinner, stopSpinner } from '../../lib/spinner.js'
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js'
import {
  NETLIFYDEV,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  chalk,
  error,
  exit,
  getToken,
  log,
  logJson,
  warn,
  APIError,
} from '../../utils/command-helpers.js'
import { DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.js'
import { type DeployEvent, deploySite } from '../../utils/deploy/deploy-site.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import { getFunctionsManifestPath, getInternalFunctionsDir } from '../../utils/functions/index.js'
import openBrowser from '../../utils/open-browser.js'
import BaseCommand from '../base-command.js'
import { link } from '../link/link.js'
import { sitesCreate } from '../sites/sites-create.js'
import { $TSFixMe } from '../types.js'

// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
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
    if ((error_ as APIError).status === 404) {
      error('Site not found. Please rerun "netlify link" and make sure that your site has CI configured.')
    } else {
      error((error_ as APIError).message)
    }
  }
}

/** Retrieves the folder containing the static files that need to be deployed */
const getDeployFolder = async ({
  command,
  config,
  options,
  site,
  siteData,
}: {
  command: BaseCommand
  config: $TSFixMe
  options: OptionValues
  site: $TSFixMe
  siteData: $TSFixMe
}): Promise<string> => {
  let deployFolder: string | undefined
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
    deployFolder = promptPath as string
  }

  return deployFolder
}

const validateDeployFolder = async (deployFolder: string) => {
  let stats: Stats
  try {
    stats = await stat(deployFolder)
  } catch (error_) {
    if (error_ && typeof error_ === 'object' && 'code' in error_) {
      if (error_.code === 'ENOENT') {
        return error(
          `The deploy directory "${deployFolder}" has not been found. Did you forget to run 'netlify build'?`,
        )
      }

      // Improve the message of permission errors
      if (error_.code === 'EACCES') {
        return error('Permission error when trying to access deploy folder')
      }
    }
    throw error_
  }

  if (!stats.isDirectory()) {
    return error('Deploy target must be a path to a directory')
  }
  return stats
}

/** get the functions directory */
const getFunctionsFolder = ({
  config,
  options,
  site,
  siteData,
  workingDir,
}: {
  config: $TSFixMe
  options: OptionValues
  site: $TSFixMe
  siteData: $TSFixMe
  /** The process working directory where the build command is executed  */
  workingDir: string
}): string | undefined => {
  let functionsFolder: string | undefined
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

const validateFunctionsFolder = async (functionsFolder: string | undefined) => {
  let stats: Stats | undefined
  if (functionsFolder) {
    // we used to hard error if functions folder is specified but doesn't exist
    // but this was too strict for onboarding. we can just log a warning.
    try {
      stats = await stat(functionsFolder)
    } catch (error_) {
      if (error_ && typeof error_ === 'object' && 'code' in error_) {
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
  }

  if (stats && !stats.isDirectory()) {
    error('Functions folder must be a path to a directory')
  }

  return stats
}

const validateFolders = async ({
  deployFolder,
  functionsFolder,
}: {
  deployFolder: string
  functionsFolder?: string
}) => {
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
// @ts-expect-error TS(7031) FIXME: Binding element 'deployFolder' implicitly has an '... Remove this comment to see the full error message
const getDeployFilesFilter = ({ deployFolder, site }) => {
  // site.root === deployFolder can happen when users run `netlify deploy --dir .`
  // in that specific case we don't want to publish the repo node_modules
  // when site.root !== deployFolder the behaviour matches our buildbot
  const skipNodeModules = site.root === deployFolder

  /**
   * @param {string} filename
   */
  // @ts-expect-error TS(7006) FIXME: Parameter 'filename' implicitly has an 'any' type.
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

// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
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

// @ts-expect-error TS(7006) FIXME: Parameter 'actual' implicitly has an 'any' type.
const hasErrorMessage = (actual, expected) => {
  if (typeof actual === 'string') {
    return actual.includes(expected)
  }
  return false
}

// @ts-expect-error TS(7031) FIXME: Binding element 'error_' implicitly has an 'any' t... Remove this comment to see the full error message
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
  const spinnersByType: Record<DeployEvent['type'], Spinner> = {}
  return (event: DeployEvent) => {
    switch (event.phase) {
      case 'start': {
        spinnersByType[event.type] = startSpinner({
          text: event.msg,
        })
        return
      }
      case 'progress': {
        const spinner = spinnersByType[event.type]
        if (spinner) {
          spinner.text = event.msg
        }
        return
      }
      case 'error':
        stopSpinner({ error: true, spinner: spinnersByType[event.type], text: event.msg })
        delete spinnersByType[event.type]
        return
      case 'stop':
      default: {
        stopSpinner({ spinner: spinnersByType[event.type], text: event.msg })
        delete spinnersByType[event.type]
      }
    }
  }
}

const uploadDeployBlobs = async ({
  cachedConfig,
  deployId,
  options,
  packagePath,
  silent,
  siteId,
}: {
  cachedConfig: $TSFixMe
  deployId: string
  options: OptionValues
  packagePath?: string
  silent: boolean
  siteId: string
}) => {
  const statusCb = silent ? () => {} : deployProgressCb()

  statusCb({
    type: 'blobs-uploading',
    msg: 'Uploading blobs to deploy store...\n',
    phase: 'start',
  })

  const [token] = await getToken()

  const blobsToken = token || undefined
  const { success } = await runCoreSteps(['blobs_upload'], {
    ...options,
    quiet: silent,
    cachedConfig,
    packagePath,
    deployId,
    siteId,
    token: blobsToken,
  })

  if (!success) {
    statusCb({
      type: 'blobs-uploading',
      msg: 'Deploy aborted due to error while uploading blobs to deploy store',
      phase: 'error',
    })

    error('Error while uploading blobs to deploy store')
  }

  statusCb({
    type: 'blobs-uploading',
    msg: 'Finished uploading blobs to deploy store',
    phase: 'stop',
  })
}

const runDeploy = async ({
  // @ts-expect-error TS(7031) FIXME: Binding element 'alias' implicitly has an 'any' ty... Remove this comment to see the full error message
  alias,
  // @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
  api,
  command,
  // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
  config,
  // @ts-expect-error TS(7031) FIXME: Binding element 'deployFolder' implicitly has an '... Remove this comment to see the full error message
  deployFolder,
  // @ts-expect-error TS(7031) FIXME: Binding element 'deployTimeout' implicitly has an ... Remove this comment to see the full error message
  deployTimeout,
  // @ts-expect-error TS(7031) FIXME: Binding element 'deployToProduction' implicitly ha... Remove this comment to see the full error message
  deployToProduction,
  // @ts-expect-error TS(7031) FIXME: Binding element 'functionsConfig' implicitly has a... Remove this comment to see the full error message
  functionsConfig,
  functionsFolder,
  // @ts-expect-error TS(7031) FIXME: Binding element 'options' implicitly has an 'a... Remove this comment to see the full error message
  options,
  // @ts-expect-error TS(7031) FIXME: Binding element 'packagePath' implicitly has an 'a... Remove this comment to see the full error message
  packagePath,
  // @ts-expect-error TS(7031) FIXME: Binding element 'silent' implicitly has an 'any' t... Remove this comment to see the full error message
  silent,
  // @ts-expect-error TS(7031) FIXME: Binding element 'site' implicitly has an 'any' typ... Remove this comment to see the full error message
  site,
  // @ts-expect-error TS(7031) FIXME: Binding element 'siteData' implicitly has an 'any'... Remove this comment to see the full error message
  siteData,
  // @ts-expect-error TS(7031) FIXME: Binding element 'siteId' implicitly has an 'any' t... Remove this comment to see the full error message
  siteId,
  // @ts-expect-error TS(7031) FIXME: Binding element 'skipFunctionsCache' implicitly ha... Remove this comment to see the full error message
  skipFunctionsCache,
  // @ts-expect-error TS(7031) FIXME: Binding element 'title' implicitly has an 'any' ty... Remove this comment to see the full error message
  title,
}: {
  functionsFolder?: string
  command: BaseCommand
}): Promise<{
  siteId: string
  siteName: string
  deployId: string
  siteUrl: string
  deployUrl: string
  logsUrl: string
  functionLogsUrl: string
  edgeFunctionLogsUrl: string
}> => {
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

    const internalFunctionsFolder = await getInternalFunctionsDir({ base: site.root, packagePath, ensureExists: true })

    await command.netlify.frameworksAPIPaths.functions.ensureExists()

    // The order of the directories matter: zip-it-and-ship-it will prioritize
    // functions from the rightmost directories. In this case, we want user
    // functions to take precedence over internal functions.
    const functionDirectories = [
      internalFunctionsFolder,
      command.netlify.frameworksAPIPaths.functions.path,
      functionsFolder,
    ].filter((folder): folder is string => Boolean(folder))
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
      // @ts-expect-error TS(2322) FIXME: Type 'string' is not assignable to type 'never'.
      headersFiles: [headersPath],
      minimal: true,
    })

    config.headers = headers
    await uploadDeployBlobs({
      deployId,
      siteId,
      silent,
      options,
      cachedConfig: command.netlify.cachedConfig,
      packagePath: command.workspacePackage,
    })

    results = await deploySite(command, api, siteId, deployFolder, {
      // @ts-expect-error FIXME
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

  let functionLogsUrl = `${results.deploy.admin_url}/logs/functions`
  let edgeFunctionLogsUrl = `${results.deploy.admin_url}/logs/edge-functions`

  if (!deployToProduction) {
    functionLogsUrl += `?scope=deploy:${deployId}`
    edgeFunctionLogsUrl += `?scope=deployid:${deployId}`
  }

  return {
    siteId: results.deploy.site_id,
    siteName: results.deploy.name,
    deployId: results.deployId,
    siteUrl,
    deployUrl,
    logsUrl,
    functionLogsUrl,
    edgeFunctionLogsUrl,
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
// @ts-expect-error TS(7031) FIXME: Binding element 'cachedConfig' implicitly has an '... Remove this comment to see the full error message
const handleBuild = async ({ cachedConfig, currentDir, defaultConfig, deployHandler, options, packagePath }) => {
  if (!options.build) {
    return {}
  }
  const [token] = await getToken()
  const resolvedOptions = await getBuildOptions({
    cachedConfig,
    defaultConfig,
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
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const bundleEdgeFunctions = async (options, command: BaseCommand) => {
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
    edgeFunctionsBootstrapURL: await getBootstrapURL(),
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

interface JsonData {
  site_id: string
  site_name: string
  deploy_id: string
  deploy_url: string
  logs: string
  function_logs: string
  edge_function_logs: string
  url?: string
}

const printResults = ({
  deployToProduction,
  isIntegrationDeploy,
  json,
  results,
  runBuildCommand,
}: {
  deployToProduction: boolean
  isIntegrationDeploy: boolean
  json: boolean
  results: Awaited<ReturnType<typeof prepAndRunDeploy>>
  runBuildCommand: boolean
}): void => {
  const msgData: Record<string, string> = {
    'Build logs': results.logsUrl,
    'Function logs': results.functionLogsUrl,
    'Edge function Logs': results.edgeFunctionLogsUrl,
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
    const jsonData: JsonData = {
      site_id: results.siteId,
      site_name: results.siteName,
      deploy_id: results.deployId,
      deploy_url: results.deployUrl,
      logs: results.logsUrl,
      function_logs: results.functionLogsUrl,
      edge_function_logs: results.edgeFunctionLogsUrl,
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
  // @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
  api,
  // @ts-expect-error TS(7031) FIXME: Binding element 'command' implicitly has an 'any' ... Remove this comment to see the full error message
  command,
  // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
  config,
  // @ts-expect-error TS(7031) FIXME: Binding element 'deployToProduction' implicitly ha... Remove this comment to see the full error message
  deployToProduction,
  // @ts-expect-error TS(7031) FIXME: Binding element 'options' implicitly has an 'any' ... Remove this comment to see the full error message
  options,
  // @ts-expect-error TS(7031) FIXME: Binding element 'site' implicitly has an 'any' typ... Remove this comment to see the full error message
  site,
  // @ts-expect-error TS(7031) FIXME: Binding element 'siteData' implicitly has an 'any'... Remove this comment to see the full error message
  siteData,
  // @ts-expect-error TS(7031) FIXME: Binding element 'siteId' implicitly has an 'any' t... Remove this comment to see the full error message
  siteId,
  // @ts-expect-error TS(7031) FIXME: Binding element 'workingDir' implicitly has an 'an... Remove this comment to see the full error message
  workingDir,
}) => {
  const alias = options.alias || options.branch
  // if a context is passed besides dev, we need to pull env vars from that specific context
  if (options.context && options.context !== 'dev') {
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

  const siteEnv = await getEnvelopeEnv({
    api,
    context: options.context,
    env: command.netlify.cachedConfig.env,
    raw: true,
    scope: 'functions',
    siteInfo: siteData,
  })

  const functionsConfig = normalizeFunctionsConfig({
    functionsConfig: config.functions,
    projectRoot: site.root,
    siteEnv,
  })

  const results = await runDeploy({
    // @ts-expect-error FIXME
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
    options,
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

export const deploy = async (options: OptionValues, command: BaseCommand) => {
  const { workingDir } = command
  const { api, site, siteInfo } = command.netlify
  const alias = options.alias || options.branch
  const settings = await detectFrameworkSettings(command, 'build')

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
    // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type '{}'.
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
      // @ts-expect-error TS(2322) FIXME: Type 'undefined' is not assignable to type '{}'.
      siteData = await sitesCreate({}, command)
      // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type '{}'.
      site.id = siteData.id
      siteId = site.id
    } else if (initChoice === EXISTING_SITE) {
      siteData = await link({}, command)
      // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type '{}'.
      site.id = siteData.id
      siteId = site.id
    }
  }

  if (options.trigger) {
    return triggerDeploy({ api, options, siteData, siteId })
  }

  // @ts-expect-error TS(2339) FIXME: Property 'published_deploy' does not exist on type... Remove this comment to see the full error message
  const deployToProduction = options.prod || (options.prodIfUnlocked && !siteData.published_deploy.locked)

  let results = {} as Awaited<ReturnType<typeof prepAndRunDeploy>>

  if (options.build) {
    await handleBuild({
      packagePath: command.workspacePackage,
      cachedConfig: command.netlify.cachedConfig,
      defaultConfig: getDefaultConfig(settings),
      currentDir: command.workingDir,
      options,
      deployHandler: async ({ netlifyConfig }: { netlifyConfig: NetlifyConfig }) => {
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

        return { newEnvChanges: { DEPLOY_ID: results.deployId, DEPLOY_URL: results.deployUrl } }
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
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
    await openBrowser({ url: urlToOpen })
    exit()
  }
}
