import { randomBytes } from 'crypto'
import type { Stats } from 'fs'
import { stat } from 'fs/promises'
import { basename, resolve } from 'path'
import { stdin, stdout } from 'process'

import type { NetlifyAPI } from '@netlify/api'
import { type NetlifyConfig, type OnPostBuild, runCoreSteps } from '@netlify/build'
import inquirer from 'inquirer'
import { type MinimalHeader, parseAllHeaders } from '@netlify/headers-parser'
import { parseAllRedirects } from '@netlify/redirect-parser'
import prettyjson from 'prettyjson'

import { cancelDeploy } from '../../lib/api.js'
import {
  type CachedConfig,
  type DefaultConfig,
  type PatchedHandlerType,
  getRunBuildOptions,
  runBuild,
} from '../../lib/build.js'
import { getBootstrapURL } from '../../lib/edge-functions/bootstrap.js'
import { featureFlags as edgeFunctionsFeatureFlags } from '../../lib/edge-functions/consts.js'
import { type NormalizedFunctionsConfig, normalizeFunctionsConfig } from '../../lib/functions/config.js'
import { BACKGROUND_FUNCTIONS_WARNING } from '../../lib/log.js'
import { type Spinner, startSpinner, stopSpinner } from '../../lib/spinner.js'
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js'
import {
  NETLIFY_CYAN_HEX,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  chalk,
  logAndThrowError,
  exit,
  getToken,
  log,
  logJson,
  warn,
  type APIError,
} from '../../utils/command-helpers.js'
import { DEFAULT_CONCURRENT_HASH, DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.js'
import { type DeployEvent, deploySite } from '../../utils/deploy/deploy-site.js'
import { getDeploySourceFields } from '../../utils/deploy/deploy-source.js'
import { uploadSourceZip } from '../../utils/deploy/upload-source-zip.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import { mergeDeployEnvVars } from '../../utils/env/deploy-env-vars.js'
import {
  getFunctionsManifestPath,
  getInternalFunctionsDir,
  getServerManifestPath,
} from '../../utils/functions/index.js'
import { isEmpty } from '../../utils/object-utilities.js'
import openBrowser from '../../utils/open-browser.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import { resolveTeamForNonInteractive } from '../../utils/team.js'
import {
  type DropApiError,
  getDropToken,
  createDropDeploy,
  uploadDropFiles,
  waitForDropDeploy,
} from '../../utils/deploy/drop-api.js'
import { getUploadList } from '../../utils/deploy/util.js'
import hashFiles from '../../utils/deploy/hash-files.js'
import { deployFileNormalizer, getEdgeFunctionsDistPathIfExists } from '../../utils/deploy/process-files.js'
import type BaseCommand from '../base-command.js'
import { link } from '../link/link.js'
import { sitesCreate } from '../sites/sites-create.js'
import type { NetlifyOptions, NetlifySite } from '../types.js'
import type { SiteInfo } from '../../utils/types.js'
import type { DeployOptionValues } from './option_values.js'
import boxen from 'boxen'
import terminalLink from 'terminal-link'
import { anyEdgeFunctionsDirectoryExists } from '../../lib/edge-functions/get-directories.js'

/**
 * The parts of the resolved configuration a deploy reads and uploads. Satisfied both by the CLI's cached config and
 * by the `NetlifyConfig` that `@netlify/build` hands to the deploy handler.
 */
interface DeployConfig {
  build: { base: string; publish?: string }
  functions?: NetlifyConfig['functions']
  functionsDirectory?: string
  headers?: NetlifyConfig['headers'] | MinimalHeader[]
  redirects?: unknown[]
}

// FIXME: `site.root` is typed as optional, but it is always set to the build directory by the time a deploy runs
type DeploySite = NetlifySite & { root: string }

// FIXME(@netlify/api): `SiteInfo['build_settings']` is missing `functions_dir`
type DeploySiteData = { build_settings?: SiteInfo['build_settings'] & { functions_dir?: string } } | undefined

// FIXME(@netlify/api): the `createSiteDeploy` types omit the source zip fields and make `id` optional
type CreatedDeploy = Omit<Awaited<ReturnType<NetlifyAPI['createSiteDeploy']>>, 'id'> & {
  id: string
  source_zip_upload_url?: string
  source_zip_filename?: string
}

const triggerDeploy = async ({
  api,
  options,
  siteData,
  siteId,
}: {
  api: NetlifyAPI
  options: DeployOptionValues
  siteData: { name: string }
  siteId: string
}) => {
  try {
    const siteBuild = await api.createSiteBuild({ siteId })
    if (options.json) {
      logJson({
        site_id: siteId,
        site_name: siteData.name,
        deploy_id: `${siteBuild.deploy_id}`,
        logs: `https://app.netlify.com/projects/${siteData.name}/deploys/${siteBuild.deploy_id}`,
      })
    } else {
      log(
        `${NETLIFYDEVLOG} A new deployment was triggered successfully. Visit https://app.netlify.com/projects/${siteData.name}/deploys/${siteBuild.deploy_id} to see the logs.`,
      )
    }
  } catch (error_) {
    if ((error_ as APIError).status === 404) {
      return logAndThrowError(
        'Project not found. Please rerun "netlify link" and make sure that your project has CI configured.',
      )
    } else {
      return logAndThrowError((error_ as APIError).message)
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
  config: DeployConfig
  options: DeployOptionValues
  site: DeploySite
  siteData: DeploySiteData
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
    if (!stdin.isTTY || !stdout.isTTY) {
      // non interactive - can't get the value, resolve to the cwd
      if (command.workspacePackage) {
        return command.jsWorkspaceRoot || site.root
      }
      return command.workingDir
    }

    log('Please provide a publish directory (e.g. "public" or "dist" or "."):')

    // Generate copy-pasteable command with current options
    const copyableCommand = generateDeployCommand({ ...options, dir: '<PATH>' }, [], command)

    log(`\nTo specify directory non-interactively, use: ${copyableCommand}\n`)

    const { promptPath } = await inquirer.prompt<{ promptPath: string }>([
      {
        type: 'input',
        name: 'promptPath',
        message: 'Publish directory',
        default: '.',
        filter: (input: string) => resolve(command.workingDir, input),
      },
    ])
    deployFolder = promptPath
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
        return logAndThrowError(
          `The deploy directory "${deployFolder}" has not been found. Did you forget to run 'netlify build'?`,
        )
      }

      // Improve the message of permission errors
      if (error_.code === 'EACCES') {
        return logAndThrowError('Permission error when trying to access deploy folder')
      }
    }
    throw error_
  }

  if (!stats.isDirectory()) {
    return logAndThrowError('Deploy target must be a path to a directory')
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
  config: DeployConfig
  options: DeployOptionValues
  site: DeploySite
  siteData: DeploySiteData
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
          return logAndThrowError('Permission error when trying to access functions folder')
        }
      }
    }
  }

  if (stats && !stats.isDirectory()) {
    return logAndThrowError('Functions folder must be a path to a directory')
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

const getDeployFilesFilter = ({ deployFolder, site }: { deployFolder: string; site: DeploySite }) => {
  // site.root === deployFolder can happen when users run `netlify deploy --dir .`
  // in that specific case we don't want to publish the repo node_modules
  // when site.root !== deployFolder the behaviour matches our buildbot
  const skipNodeModules = site.root === deployFolder

  return (filename: string) => {
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

// Helper function to generate copy-pasteable deploy command
const generateDeployCommand = (
  options: DeployOptionValues,
  availableTeams: { name: string; slug: string }[],
  command?: BaseCommand,
): string => {
  const parts = ['netlify deploy']

  if (options.createSite) {
    const siteName = typeof options.createSite === 'string' ? options.createSite : '<SITE_NAME>'
    parts.push(`--site-name ${siteName}`)
    if (availableTeams.length > 1) {
      parts.push('--team <TEAM_SLUG>')
    }
  } else if (options.site) {
    parts.push(`--site ${options.site}`)
  } else {
    parts.push('--site <SITE>')
  }

  if (command?.options) {
    for (const option of command.options) {
      // `env` and `secretEnv` are skipped because reprinting a secret value here would leak it.
      if (
        [
          'createSite',
          'site',
          'siteName',
          'team',
          // Don't print secret information
          'env',
          'secretEnv',
        ].includes(option.attributeName())
      ) {
        continue
      }

      const optionName = option.attributeName() as keyof DeployOptionValues
      const value = options[optionName]

      if (option.long?.startsWith('--no-')) {
        if (value === false) {
          parts.push(option.long)
        }
        continue
      }

      if (optionName === 'build') {
        continue
      }

      if (value && option.long) {
        const flag = option.long
        const hasValue = option.required || option.optional

        if (hasValue && typeof value === 'string') {
          const quotedValue = optionName === 'message' ? `"${value}"` : value
          parts.push(`${flag} ${quotedValue}`)
        } else if (hasValue && typeof value === 'number') {
          parts.push(`${flag} ${value}`)
        } else if (!hasValue && value === true) {
          parts.push(flag)
        }
      }
    }
  }

  return parts.join(' ')
}

const prepareProductionDeploy = async ({
  api,
  siteData,
  options,
  command,
}: {
  api: NetlifyAPI
  siteData: SiteInfo
  options: DeployOptionValues
  command: BaseCommand
}) => {
  if (
    typeof siteData.published_deploy === 'object' &&
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- FIXME: a non-object `published_deploy` must not count as locked
    siteData.published_deploy !== null &&
    siteData.published_deploy.locked
  ) {
    log(`\n${NETLIFYDEVERR} Deployments are "locked" for production context of this project\n`)

    const overrideCommand = generateDeployCommand({ ...options, prodIfUnlocked: true, prod: false }, [], command)

    if (!isInteractive()) {
      return logAndThrowError(
        `Deployments are "locked" for production context of this project.\n\n` +
          `To deploy anyway, use:\n  ${overrideCommand}`,
      )
    }

    log('\nTo override deployment lock (USE WITH CAUTION), use:')
    log(`  ${overrideCommand}`)
    log('\nWarning: Only use --prod-if-unlocked if you are absolutely sure you want to override the deployment lock.\n')

    const { unlockChoice } = await inquirer.prompt<{ unlockChoice: boolean }>([
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
}

const hasErrorMessage = (actual: unknown, expected: string): boolean => {
  if (typeof actual === 'string') {
    return actual.includes(expected)
  }
  return false
}

interface DeployError extends Error {
  json?: { message?: string }
  status?: unknown
}
const reportDeployError = ({
  error,
  failAndExit,
}: {
  error: DeployError
  failAndExit: (err: unknown) => never
}): never => {
  switch (true) {
    case error.name === 'JSONHTTPError': {
      const message = error.json?.message ?? ''
      if (hasErrorMessage(message, 'Background Functions not allowed by team plan')) {
        return failAndExit(`\n${BACKGROUND_FUNCTIONS_WARNING}`)
      }
      warn(`JSONHTTPError: ${message} ${error.status}`)
      warn(`\n${JSON.stringify(error, null, '  ')}\n`)
      return failAndExit(error)
    }
    case error.name === 'TextHTTPError': {
      warn(`TextHTTPError: ${error.status}`)
      warn(`\n${error}\n`)
      return failAndExit(error)
    }
    case hasErrorMessage(error.message, 'Invalid filename'): {
      warn(error.message)
      return failAndExit(error)
    }
    default: {
      warn(`\n${JSON.stringify(error, null, '  ')}\n`)
      return failAndExit(error)
    }
  }
}

const deployProgressCb = function () {
  const spinnersByType: Partial<Record<DeployEvent['type'], Spinner>> = {}
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
          spinner.update({ text: event.msg })
        }
        return
      }
      case 'error':
        stopSpinner({ error: true, spinner: spinnersByType[event.type], text: event.msg })
        delete spinnersByType[event.type]
        return
      case 'stop':
      default: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- FIXME: a `stop` event is assumed to follow a `start` event of the same type
        spinnersByType[event.type]!.success(event.msg)
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
  cachedConfig: CachedConfig
  deployId: string
  options: DeployOptionValues
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
    // We log our own progress so we don't want this as well. Plus, this logs much of the same
    // information as the build that (likely) came before this as part of the deploy build.
    quiet: options.debug ?? true,
    // @ts-expect-error FIXME(@netlify/build): the `cachedConfig` flag is typed `Record<string, unknown>`, rejecting `CachedConfig`
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

    return logAndThrowError('Error while uploading blobs to deploy store')
  }

  statusCb({
    type: 'blobs-uploading',
    msg: 'Finished uploading blobs to deploy store',
    phase: 'stop',
  })
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
  options,
  packagePath,
  silent,
  site,
  siteData,
  siteId,
  skipFunctionsCache,
  title,
  deployId: existingDeployId,
}: {
  alias: string | undefined
  api: NetlifyAPI
  command: BaseCommand
  config: DeployConfig
  deployFolder: string
  deployId?: string | undefined
  deployTimeout: number
  deployToProduction: boolean
  functionsConfig: NormalizedFunctionsConfig
  functionsFolder?: string | undefined
  options: DeployOptionValues
  packagePath: string | undefined
  silent: boolean
  site: DeploySite
  siteData: SiteInfo
  siteId: string
  skipFunctionsCache: boolean
  title: string | undefined
}): Promise<{
  siteId: string
  siteName: string
  deployId: string
  siteUrl: string
  deployUrl: string
  logsUrl: string
  functionLogsUrl: string
  edgeFunctionLogsUrl: string
  sourceZipFileName?: string
}> => {
  let results
  let deployId = existingDeployId
  let uploadSourceZipResult

  try {
    // We won't have a deploy ID if we run the command with `--no-build`.
    // In this case, we must create the deploy.
    if (!deployId) {
      if (deployToProduction) {
        await prepareProductionDeploy({ siteData, api, options, command })
      }

      const draft = options.draft || (!deployToProduction && !alias)
      const createDeployBody = {
        draft,
        branch: alias,
        include_upload_url: options.uploadSourceZip,
        ...getDeploySourceFields(),
      }

      const createDeployResponse = (await api.createSiteDeploy({
        siteId,
        title,
        body: createDeployBody,
      })) as CreatedDeploy
      deployId = createDeployResponse.id

      if (
        options.uploadSourceZip &&
        createDeployResponse.source_zip_upload_url &&
        createDeployResponse.source_zip_filename
      ) {
        uploadSourceZipResult = await uploadSourceZip({
          sourceDir: site.root,
          uploadUrl: createDeployResponse.source_zip_upload_url,
          filename: createDeployResponse.source_zip_filename,
          statusCb: silent ? () => {} : deployProgressCb(),
        })
      }
    }

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
    const manifestPath = skipFunctionsCache
      ? undefined
      : await getFunctionsManifestPath({ base: site.root, packagePath })
    const serverManifestPath = await getServerManifestPath({ base: site.root, packagePath })

    const redirectsPath = `${deployFolder}/_redirects`
    const headersPath = `${deployFolder}/_headers`

    const { redirects } = await parseAllRedirects({
      // @ts-expect-error FIXME(@netlify/redirect-parser): `configRedirects` is typed `string[]` but takes redirect objects
      configRedirects: config.redirects,
      redirectsFiles: [redirectsPath],
      minimal: true,
    })

    config.redirects = redirects

    const { headers } = await parseAllHeaders({
      // @ts-expect-error FIXME(@netlify/headers-parser): `MinimalHeader` rejects the array values `NetlifyConfig['headers']` allows
      configHeaders: config.headers,
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
      manifestPath: manifestPath ?? undefined,
      packagePath,
      serverEnabled: Boolean(siteData?.feature_flags?.netlify_build_server_standalone),
      serverManifestPath: serverManifestPath ?? undefined,
      skipFunctionsCache,
      siteRoot: site.root,
      environment: mergeDeployEnvVars(options.env, options.secretEnv),
    })
  } catch (error) {
    if (deployId) {
      await cancelDeploy({ api, deployId })
    }

    return reportDeployError({ error: error as DeployError, failAndExit: logAndThrowError })
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
    sourceZipFileName: uploadSourceZipResult?.sourceZipFileName,
  }
}

const handleBuild = async ({
  cachedConfig,
  currentDir,
  defaultConfig,
  deployHandler,
  deployId,
  options,
  packagePath,
  skewProtectionToken,
}: {
  cachedConfig: CachedConfig
  currentDir: string
  defaultConfig?: DefaultConfig | undefined
  deployHandler?: PatchedHandlerType<OnPostBuild> | undefined
  deployId?: string
  options: DeployOptionValues
  packagePath: string | undefined
  skewProtectionToken?: string
}) => {
  if (!options.build) {
    return {}
  }
  const [token] = await getToken()
  const resolvedOptions = await getRunBuildOptions({
    cachedConfig,
    currentDir,
    defaultConfig,
    deployHandler,
    deployId,
    options,
    packagePath,
    skewProtectionToken,
    token,
  })

  const { configMutations, exitCode, newConfig, logs } = await runBuild(resolvedOptions)

  // When --verbose is used with --json, pipe the build's stdout and stderr
  // to the process stderr so that callers can see the full build output
  // while still getting clean JSON on stdout.
  if (options.verbose && options.json && logs) {
    if (logs.stdout.length) {
      process.stderr.write(logs.stdout.join('\n'))
    }
    if (logs.stderr.length) {
      process.stderr.write(logs.stderr.join('\n'))
    }
  }

  // Without this, the deploy command fails silently
  if (exitCode !== 0) {
    let message = ''

    if (options.verbose && logs?.stdout.length) {
      message += `\n\n${logs.stdout.join('')}\n\n`
    }

    if (logs?.stderr.length) {
      message += logs.stderr.join('')
    }

    logAndThrowError(`Error while running build${message}`)
  }
  return { newConfig, configMutations }
}

const bundleEdgeFunctions = async (options: DeployOptionValues, command: BaseCommand): Promise<void> => {
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
    // We log our own progress so we don't want this as well. Plus, this logs much of the same
    // information as the build that (likely) came before this as part of the deploy build.
    quiet: options.debug ?? true,
    edgeFunctionsBootstrapURL: await getBootstrapURL(),
    // @ts-expect-error FIXME(@netlify/build): `cachedConfig` is typed `Record<string, unknown>` and `edgeFunctionsBootstrapURL` is missing from the flags
    cachedConfig: command.netlify.cachedConfig,
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
  source_zip_filename?: string
}

const printResults = ({
  deployToProduction,
  uploadSourceZip,
  json,
  results,
  runBuildCommand,
}: {
  deployToProduction: boolean
  uploadSourceZip: boolean
  json: boolean
  results: Awaited<ReturnType<typeof prepAndRunDeploy>>
  runBuildCommand: boolean
}): void => {
  const msgData: Record<string, string> = {
    'Build logs': terminalLink(results.logsUrl, results.logsUrl, { fallback: false }),
    'Function logs': terminalLink(results.functionLogsUrl, results.functionLogsUrl, { fallback: false }),
    'Edge function Logs': terminalLink(results.edgeFunctionLogsUrl, results.edgeFunctionLogsUrl, { fallback: false }),
  }

  log('')
  // Note: this is leakily mimicking the @netlify/build heading style
  log(chalk.cyanBright.bold(`🚀 Deploy complete\n${'─'.repeat(64)}`))

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

    if (uploadSourceZip) {
      jsonData.source_zip_filename = results.sourceZipFileName
    }

    logJson(jsonData)
    exit(0)
  } else if (!isInteractive()) {
    if (deployToProduction) {
      log(`\nProduction URL: <${results.siteUrl}>`)
      log(`Unique deploy URL: <${results.deployUrl}>`)
    } else {
      log(`\nDraft URL: <${results.deployUrl}>`)
    }
    log(`\nBuild logs: <${results.logsUrl}>`)
    log(`Function logs: <${results.functionLogsUrl}>`)
    log(`Edge function logs: <${results.edgeFunctionLogsUrl}>`)

    if (!deployToProduction) {
      log()
      log('If everything looks good on your draft URL, deploy it to your main project URL with the --prod flag:')
      log(`netlify deploy${runBuildCommand ? '' : ' --no-build'} --prod`)
      log()
    }
  } else {
    const message = deployToProduction
      ? `Deployed to production URL: ${terminalLink(results.siteUrl, results.siteUrl, { fallback: false })}\n
    Unique deploy URL: ${terminalLink(results.deployUrl, results.deployUrl, { fallback: false })}`
      : `Deployed draft to ${terminalLink(results.deployUrl, results.deployUrl, { fallback: false })}`

    log(
      boxen(message, {
        padding: 1,
        margin: 1,
        textAlignment: 'center',
        borderStyle: 'round',
        borderColor: NETLIFY_CYAN_HEX,
        // This is an intentional half-width space to work around a unicode padding math bug in boxen
        // eslint-disable-next-line no-irregular-whitespace
        title: `⬥  ${deployToProduction ? 'Production deploy' : 'Draft deploy'} is live ⬥ `,
        titleAlignment: 'center',
      }),
    )

    log(prettyjson.render(msgData))

    if (!deployToProduction) {
      log()
      log('If everything looks good on your draft URL, deploy it to your main project URL with the --prod flag:')
      log(chalk.cyanBright.bold(`netlify deploy${runBuildCommand ? '' : ' --no-build'} --prod`))
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
  deployId,
}: {
  api: NetlifyAPI
  command: BaseCommand
  config: DeployConfig
  deployToProduction: boolean
  options: DeployOptionValues
  site: DeploySite
  siteData: SiteInfo
  siteId: string
  workingDir: string
  deployId?: string
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

  // build flag wasn't used and edge functions directories exist
  if (!options.build && (await anyEdgeFunctionsDirectoryExists(command))) {
    // for the case of directories existing but not containing any edge functions,
    // there is early bail in edge functions bundling after scanning for edge functions
    // for this case and to avoid replicating scanning logic here, we defer to the bundling step
    await bundleEdgeFunctions(options, command)
  }

  log('')
  // Note: this is leakily mimicking the @netlify/build heading style
  log(chalk.cyanBright.bold(`Deploying to Netlify\n${'─'.repeat(64)}`))

  log('')
  log(
    prettyjson.render({
      'Deploy path': deployFolder,
      'Functions path': functionsFolder,
      'Configuration path': configPath,
    }),
  )
  log()

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
    alias,
    api,
    command,
    config,
    deployFolder,
    deployTimeout: options.timeout ? options.timeout * SEC_TO_MILLISEC : DEFAULT_DEPLOY_TIMEOUT,
    deployToProduction,
    functionsConfig,
    // pass undefined functionsFolder if doesn't exist
    functionsFolder: functionsFolderStat && functionsFolder,
    options,
    packagePath: command.workspacePackage,
    silent: options.json || Boolean(options.silent),
    site,
    siteData,
    siteId,
    skipFunctionsCache: options.skipFunctionsCache,
    title: options.message,
    deployId,
  })

  return results
}

const createSiteWithFlags = async (options: DeployOptionValues, command: BaseCommand, site: NetlifySite) => {
  const { accounts } = command.netlify
  const siteName = typeof options.createSite === 'string' ? options.createSite : undefined

  if (!options.team) {
    const team = resolveTeamForNonInteractive(
      accounts,
      `netlify deploy --site-name${siteName ? ` ${siteName}` : ' <SITE_NAME>'} --team <TEAM_SLUG>`,
    )
    options.team = team.slug
    const message = siteName ? `Creating new site: ${siteName}` : 'Creating new site with random name'
    log(`${message} (using team: ${team.name})`)
  } else {
    const message = siteName ? `Creating new site: ${siteName}` : 'Creating new site with random name'
    log(message)
  }

  // Create site directly via API to bypass interactive prompts
  const { api } = command.netlify
  const body: { name?: string } = {}
  if (siteName) {
    body.name = siteName.trim()
  }

  if (!options.team) {
    throw new Error('Team must be specified to create a site')
  }

  try {
    // FIXME(@netlify/api): the `site` response type makes every field optional, unlike `SiteInfo`
    const siteData = (await api.createSiteInTeam({
      accountSlug: options.team,
      body,
    })) as SiteInfo
    site.id = siteData.id
    return siteData
  } catch (error_) {
    if ((error_ as APIError).status === 422 && siteName) {
      const suffix = randomBytes(4).toString('hex')
      const suffixedName = `${siteName.trim()}-${suffix}`
      log(`Site name "${siteName}" is taken. Retrying with "${suffixedName}"...`)
      try {
        const siteData = (await api.createSiteInTeam({
          accountSlug: options.team,
          body: { name: suffixedName },
        })) as SiteInfo
        site.id = siteData.id
        return siteData
      } catch (retryError) {
        return logAndThrowError(
          `Failed to create site "${suffixedName}": ${(retryError as APIError).status}: ${
            (retryError as APIError).message
          }`,
        )
      }
    }
    if ((error_ as APIError).status === 422) {
      return logAndThrowError('Unable to create site with a random name. Please try again or specify a different name.')
    }
    return logAndThrowError(`Failed to create site: ${(error_ as APIError).status}: ${(error_ as APIError).message}`)
  }
}

const promptForSiteAction = async (options: DeployOptionValues, command: BaseCommand, site: NetlifySite) => {
  log("This folder isn't linked to a project yet")

  const { accounts } = command.netlify
  const availableTeams = accounts.map((acc) => ({ name: acc.name, slug: acc.slug }))
  const copyableCommand = generateDeployCommand(options, availableTeams, command)

  log(`\nTo create and deploy in one go, use: ${copyableCommand}`)
  if (availableTeams.length > 1) {
    log(`\nYou must pick a --team: ${availableTeams.map((team) => team.slug).join(', ')}`)
  }

  const { initChoice } = await inquirer.prompt<{ initChoice: 'link' | 'create' }>([
    {
      type: 'list',
      name: 'initChoice',
      message: 'What would you like to do?',
      choices: [
        {
          name: '⇄  Link this directory to an existing project',
          value: 'link',
        },
        {
          name: '+  Create & configure a new project',
          value: 'create',
        },
      ],
    },
  ])

  const siteData = initChoice === 'create' ? await sitesCreate({}, command) : await link({}, command)

  site.id = siteData.id
  return siteData
}

const ensureSiteExists = async (
  options: DeployOptionValues,
  command: BaseCommand,
  site: NetlifySite,
  siteInfo: SiteInfo,
): Promise<SiteInfo> => {
  const hasSiteData = (site.id || options.site) && !isEmpty(siteInfo)

  if (hasSiteData) {
    return siteInfo
  }

  if (options.createSite) {
    return createSiteWithFlags(options, command, site)
  }

  if (!isInteractive()) {
    const { accounts } = command.netlify
    options.createSite = true
    const team = resolveTeamForNonInteractive(accounts, 'netlify deploy --site-name <SITE_NAME> --team <TEAM_SLUG>')
    options.team = team.slug
    log(`No project linked. Auto-creating a new project (team: ${team.name})...`)
    return createSiteWithFlags(options, command, site)
  }

  return promptForSiteAction(options, command, site)
}

const anonymousDeploy = async (options: DeployOptionValues, command: BaseCommand) => {
  const { workingDir } = command
  const { site, config } = command.netlify as NetlifyOptions & { site: DeploySite }

  const dirHasFiles = async (dir: string | undefined): Promise<boolean> => {
    if (!dir) return false
    try {
      const stats = await stat(dir)
      if (!stats.isDirectory()) return false
      const { readdir } = await import('fs/promises')
      const entries = await readdir(dir)
      return entries.length > 0
    } catch {
      return false
    }
  }

  const checkForFunctions = async () => {
    const functionsFolder = getFunctionsFolder({ config, options, site, siteData: {}, workingDir })
    const internalFunctionsDir = await getInternalFunctionsDir({ base: site.root })
    const frameworksFunctionsDir = command.netlify.frameworksAPIPaths.functions.path

    const hasFunctions =
      (await dirHasFiles(functionsFolder)) ||
      (await dirHasFiles(internalFunctionsDir)) ||
      (await dirHasFiles(frameworksFunctionsDir))
    const hasEdgeFunctions = await anyEdgeFunctionsDirectoryExists(command)

    if (hasFunctions || hasEdgeFunctions) {
      log(
        `\n${NETLIFYDEVERR} This project includes ${hasFunctions ? 'serverless functions' : ''}${
          hasFunctions && hasEdgeFunctions ? ' and ' : ''
        }${hasEdgeFunctions ? 'edge functions' : ''} which require authentication.`,
      )
      const loginCommand = isInteractive()
        ? chalk.cyanBright('netlify login')
        : chalk.cyanBright('netlify login --request <message>')
      log(`Run ${loginCommand} first, then retry your deploy command.\n`)
      exit(1)
    }
  }

  await checkForFunctions()

  if (options.build) {
    const settings = await detectFrameworkSettings(command, 'build')
    await handleBuild({
      packagePath: command.workspacePackage,
      cachedConfig: command.netlify.cachedConfig,
      defaultConfig: getDefaultConfig(settings),
      currentDir: workingDir,
      options,
    })
    await checkForFunctions()
  }

  const deployFolder = await getDeployFolder({
    command,
    config: command.netlify.config,
    options,
    site,
    siteData: {},
  })
  await validateDeployFolder(deployFolder)

  const edgeFunctionsDistPath = await getEdgeFunctionsDistPathIfExists(workingDir)

  const filter = getDeployFilesFilter({ site, deployFolder })
  const { files, filesShaMap } = await hashFiles({
    concurrentHash: DEFAULT_CONCURRENT_HASH,
    directories: [deployFolder, edgeFunctionsDistPath].filter(Boolean) as string[],
    filter,
    normalizer: deployFileNormalizer.bind(null, workingDir),
    statusCb: options.json ? () => {} : deployProgressCb(),
  })

  const filesCount = Object.keys(files).length
  if (filesCount === 0) {
    return logAndThrowError('No files to deploy')
  }

  log(`\n${NETLIFYDEVLOG} Deploying ${filesCount} files anonymously...`)

  const apiBase = command.netlify.api.basePath

  const dropApiOptions = {
    apiBase,
    userAgent: command.netlify.api.defaultHeaders['User-agent'] || 'netlify-cli',
  }

  const statusCb = options.json ? () => {} : deployProgressCb()

  let dropToken: string
  let deployInfo: Awaited<ReturnType<typeof createDropDeploy>>
  try {
    dropToken = await getDropToken(dropApiOptions)
    deployInfo = await createDropDeploy(dropApiOptions, files, dropToken, options.createdVia)
  } catch (error) {
    const dropError = error as DropApiError
    if (dropError.status === 429) {
      const loginCommand = isInteractive()
        ? chalk.cyanBright('netlify login')
        : chalk.cyanBright('netlify login --request <message>')
      return logAndThrowError(
        `You've reached the daily limit for anonymous deploys. Run ${loginCommand} to sign up or log in, then retry your deploy.`,
      )
    }
    throw error
  }

  const uploadList = getUploadList(deployInfo.required, filesShaMap)

  if (uploadList.length > 0) {
    await uploadDropFiles(dropApiOptions, deployInfo.deploy_id, uploadList, dropToken, {
      statusCb,
    })
  }

  const deploy = await waitForDropDeploy(
    dropApiOptions,
    deployInfo.id,
    deployInfo.deploy_id,
    options.timeout ? options.timeout * 1000 : DEFAULT_DEPLOY_TIMEOUT,
  )

  site.id = deployInfo.id

  const siteUrl = deploy.ssl_url || deploy.url || `https://${deployInfo.subdomain}.netlify.app`
  const isPasswordProtected = !options.createdVia || options.createdVia === 'drop'
  const claimUrl = `https://app.netlify.com/drop/${deployInfo.subdomain}#drop_token=${dropToken}`

  if (options.json) {
    logJson({
      site_id: deployInfo.id,
      site_url: siteUrl,
      deploy_id: deployInfo.deploy_id,
      claim_url: claimUrl,
      claim_command: `netlify claim --site ${deployInfo.id} --token ${dropToken}`,
      ...(isPasswordProtected ? { password: 'My-Drop-Site' } : {}),
    })
    return
  }

  log('')
  log(chalk.cyanBright.bold(`🚀 Deploy complete\n${'─'.repeat(64)}`))
  log('')

  const boxContent = isPasswordProtected
    ? `Site URL:  ${terminalLink(siteUrl, siteUrl, { fallback: false })}\n\nPassword:  My-Drop-Site`
    : `Site URL:  ${terminalLink(siteUrl, siteUrl, { fallback: false })}`

  log(
    boxen(boxContent, {
      padding: 1,
      margin: 1,
      textAlignment: 'center',
      borderStyle: 'round',
      borderColor: NETLIFY_CYAN_HEX,
      title: `⬥  Anonymous deploy is live ⬥ `,
      titleAlignment: 'center',
    }),
  )
  log(`  ${chalk.bold('Claim on Netlify:')}`)
  log(`  ${claimUrl}`)
  log('')
  log(`  ${chalk.bold('Claim via CLI:')}`)
  log(`  netlify claim --site ${deployInfo.id} --token ${dropToken}`)
  log('')
  warn('Anonymously deployed sites need to be claimed within 60 minutes.')
  log('')
}

export const deploy = async (options: DeployOptionValues, command: BaseCommand) => {
  const { workingDir } = command
  const { api, site, siteInfo } = command.netlify
  const alias = options.alias || options.branch

  command.setAnalyticsPayload({ open: options.open, prod: options.prod, json: options.json, alias: Boolean(alias) })

  if (options.allowAnonymous) {
    const [token] = await getToken(options.auth)
    if (token) {
      log(`${NETLIFYDEVLOG} You are logged in — deploying to your team.`)
      const hasSiteData = (site.id || options.site) && siteInfo.url
      if (!hasSiteData && !options.createSite) {
        return logAndThrowError(
          `No project linked. Use ${chalk.cyanBright(
            '--create-site <name>',
          )} to create a new site, or ${chalk.cyanBright('--site <name-or-id>')} to deploy to an existing project.`,
        )
      }
    } else {
      if (options.env != null || options.secretEnv != null) {
        return logAndThrowError(
          `${chalk.cyanBright('--env')} and ${chalk.cyanBright(
            '--secret-env',
          )} require an account. Log in, or deploy without them.`,
        )
      }
      return anonymousDeploy(options, command)
    }
  }

  const [authToken] = await getToken(options.auth)
  if (!authToken && !isInteractive()) {
    return logAndThrowError(
      `Authentication required. NETLIFY_AUTH_TOKEN is not set and ${chalk.cyanBright(
        '`netlify login --request <message>`',
      )} can be used to authenticate.\nAlternatively, use ${chalk.cyanBright(
        '--allow-anonymous',
      )} to deploy without an account.`,
    )
  }
  await command.authenticate(options.auth)

  const siteData = await ensureSiteExists(options, command, site, siteInfo)
  const siteId = siteData.id

  if (options.trigger) {
    return triggerDeploy({ api, options, siteData, siteId })
  }

  const deployToProduction =
    !options.draft && (options.prod || (options.prodIfUnlocked && !(siteData.published_deploy?.locked ?? false)))

  let results = {} as Awaited<ReturnType<typeof prepAndRunDeploy>>

  if (options.build) {
    if (deployToProduction) {
      await prepareProductionDeploy({ siteData, api, options, command })
    }

    const draft = options.draft || (!deployToProduction && !alias)
    const createDeployBody = {
      draft,
      branch: alias,
      include_upload_url: options.uploadSourceZip,
      ...getDeploySourceFields(),
    }

    const deployMetadata = (await api.createSiteDeploy({
      siteId,
      title: options.message,
      body: createDeployBody,
    })) as CreatedDeploy
    const deployId = deployMetadata.id || ''
    const skewProtectionToken = deployMetadata.skew_protection_token
    let sourceZipFileName: string | undefined

    if (
      options.uploadSourceZip &&
      deployMetadata.source_zip_upload_url &&
      deployMetadata.source_zip_filename &&
      site.root
    ) {
      await uploadSourceZip({
        sourceDir: site.root,
        uploadUrl: deployMetadata.source_zip_upload_url,
        filename: deployMetadata.source_zip_filename,
        statusCb: options.json || options.silent ? () => {} : deployProgressCb(),
      })
      sourceZipFileName = deployMetadata.source_zip_filename
    }
    try {
      const settings = await detectFrameworkSettings(command, 'build')
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
            site: site as DeploySite,
            config: netlifyConfig,
            siteData,
            siteId,
            deployToProduction,
            deployId,
          })

          return {}
        },
        deployId,
        skewProtectionToken,
      })

      // Ensure source zip filename is included in results for JSON output
      if (sourceZipFileName) {
        results.sourceZipFileName = sourceZipFileName
      }
    } catch (error) {
      // The build has failed, so let's cancel the deploy we created.
      await cancelDeploy({ api, deployId })

      throw error
    }
  } else {
    results = await prepAndRunDeploy({
      command,
      options,
      workingDir,
      api,
      site: site as DeploySite,
      config: command.netlify.config,
      siteData,
      siteId,
      deployToProduction,
    })
  }
  printResults({
    runBuildCommand: options.build,
    json: options.json,
    results,
    deployToProduction,
    uploadSourceZip: !!options.uploadSourceZip,
  })

  if (options.open) {
    const urlToOpen = deployToProduction ? results.siteUrl : results.deployUrl
    await openBrowser({ url: urlToOpen })
    exit()
  }
}
