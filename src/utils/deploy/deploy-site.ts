import { rm } from 'fs/promises'

import type { NetlifyAPI } from '@netlify/api'
import { getVersion as getNetlifyBuildVersion } from '@netlify/build'
import type { Config as FunctionsConfig } from '@netlify/zip-it-and-ship-it'
import cleanDeep from 'clean-deep'

import type BaseCommand from '../../commands/base-command.js'
import { warn } from '../command-helpers.js'

import {
  DEFAULT_CONCURRENT_HASH,
  DEFAULT_CONCURRENT_UPLOAD,
  DEFAULT_DEPLOY_TIMEOUT,
  DEFAULT_MAX_RETRY,
  DEFAULT_SYNC_LIMIT,
} from './constants.js'
import { hashConfig } from './hash-config.js'
import hashEdgeFunctions from './hash-edge-functions.js'
import hashFiles from './hash-files.js'
import hashFns from './hash-fns.js'
import {
  deployFileNormalizer,
  getDbMigrationsDistPathIfExists,
  getDeployConfigPathIfExists,
  getEdgeFunctionsDistPathIfExists,
  isEdgeFunctionFile,
} from './process-files.js'
import uploadFiles from './upload-files.js'
import { type Deploy, getUploadList, waitForDeploy, waitForDiff } from './util.js'
import type { File } from './file.js'
import type { DeployEvent, StatusCallback } from './status-cb.js'
import type { DeployEnvironmentVariable } from '../env/deploy-env-vars.js'
import { temporaryDirectory } from '../temporary-file.js'

export type { DeployEvent }

// FIXME(@netlify/api): every `deploy` field is optional, even those always set once a deploy is diffed
type DiffedDeploy = Deploy & Required<Pick<Deploy, 'id'>>

const buildStatsString = (possibleParts: (string | false | undefined)[]) => {
  const parts = possibleParts.filter(Boolean)
  const message = parts.slice(0, -1).join(', ')

  return parts.length > 1 ? `${message} and ${parts[parts.length - 1]}` : message
}

export interface DeploySiteOptions {
  assetType?: 'file' | undefined
  branch?: string
  concurrentHash?: number
  concurrentUpload?: number
  /** The site configuration, uploaded as the deploy's `netlify.toml` */
  config: object
  deployId: string
  deployTimeout?: number
  draft?: boolean
  environment?: DeployEnvironmentVariable[]
  filter: (filename: string) => boolean
  fnDir?: string[]
  functionsConfig?: FunctionsConfig | undefined
  hashAlgorithm?: string
  manifestPath?: string | undefined
  maxRetry?: number
  packagePath?: string | undefined
  serverEnabled?: boolean
  serverManifestPath?: string | undefined
  siteRoot?: string | undefined
  skipFunctionsCache?: boolean | undefined
  statusCb?: StatusCallback
  syncFileLimit?: number
  tmpDir?: string
  workingDir: string
}

export const deploySite = async (
  command: BaseCommand,
  api: NetlifyAPI,
  siteId: string,
  dir: string,
  {
    assetType,
    branch,
    concurrentHash = DEFAULT_CONCURRENT_HASH,
    concurrentUpload = DEFAULT_CONCURRENT_UPLOAD,
    config,
    deployId,
    deployTimeout = DEFAULT_DEPLOY_TIMEOUT,
    draft = false,
    environment,
    filter,
    fnDir = [],
    functionsConfig,
    hashAlgorithm,
    manifestPath,
    maxRetry = DEFAULT_MAX_RETRY,
    packagePath,
    serverEnabled,
    serverManifestPath,
    siteRoot,
    skipFunctionsCache,
    statusCb = () => {
      /* default to noop */
    },
    syncFileLimit = DEFAULT_SYNC_LIMIT,
    tmpDir = temporaryDirectory(),
    workingDir,
  }: DeploySiteOptions,
) => {
  statusCb({
    type: 'hashing',
    msg: `Hashing files...`,
    phase: 'start',
  })

  const edgeFunctionsDistPath = await getEdgeFunctionsDistPathIfExists(workingDir)
  const deployConfigPath = await getDeployConfigPathIfExists(workingDir)
  const dbMigrationsDistPath = await getDbMigrationsDistPathIfExists(workingDir)
  const [
    { files: staticFiles, filesShaMap: staticShaMap },
    { fnConfig, fnShaMap, functionSchedules, functions, functionsWithNativeModules, server, serverShaMap },
    configFile,
    { edgeFunctions, edgeFnShaMap },
  ] = await Promise.all([
    hashFiles({
      assetType,
      concurrentHash,
      directories: [dir, edgeFunctionsDistPath, deployConfigPath, dbMigrationsDistPath].filter(Boolean) as string[],
      filter,
      hashAlgorithm,
      normalizer: deployFileNormalizer.bind(null, workingDir),
      statusCb,
    }),
    hashFns(command, fnDir, {
      functionsConfig,
      tmpDir,
      concurrentHash,
      hashAlgorithm,
      statusCb,
      manifestPath,
      packagePath,
      serverEnabled,
      serverManifestPath,
      skipFunctionsCache,
      rootDir: siteRoot,
    }),
    hashConfig({ config }),
    hashEdgeFunctions(edgeFunctionsDistPath, { hashAlgorithm, statusCb }),
  ])

  const files = { ...staticFiles, [configFile.normalizedPath]: configFile.hash }
  const filesShaMap: Record<string, (File | typeof configFile)[]> = { ...staticShaMap, [configFile.hash]: [configFile] }

  const edgeFunctionsCount = Object.keys(files).filter(isEdgeFunctionFile).length
  const filesCount = Object.keys(files).length - edgeFunctionsCount
  const functionsCount = Object.keys(functions).length
  const stats = buildStatsString([
    filesCount > 0 && `${filesCount} files`,
    functionsCount > 0 && `${functionsCount} functions`,
    edgeFunctionsCount > 0 && 'edge functions',
  ])

  statusCb({
    type: 'hashing',
    msg: `Finished hashing ${stats}`,
    phase: 'stop',
  })

  if (filesCount === 0 && functionsCount === 0) {
    throw new Error('No files or functions to deploy')
  }

  if (functionsWithNativeModules.length !== 0) {
    const functionsWithNativeModulesMessage = functionsWithNativeModules.map(({ name }) => `- ${name}`).join('\n')
    warn(`Modules with native dependencies\n
    ${functionsWithNativeModulesMessage}

The serverless functions above use Node.js modules with native dependencies, which
must be installed on a system with the same architecture as the function runtime. A
mismatch in the system and runtime may lead to errors when invoking your functions.
To ensure your functions work as expected, we recommend using continuous deployment
instead of manual deployment.

For more information, visit https://ntl.fyi/cli-native-modules.`)
  }

  statusCb({
    type: 'create-deploy',
    msg: 'CDN diffing files...',
    phase: 'start',
  })

  const packageFrameworks = command.project.frameworks.get(command.workspacePackage ?? '')
  const primaryFramework = packageFrameworks?.[0]

  const async = Object.keys(files).length > syncFileLimit
  const bodyToClean = {
    files,
    functions,
    edge_functions: edgeFunctions,
    server,
    function_schedules: functionSchedules,
    functions_config: fnConfig,
    async,
    branch,
    draft,
    framework: primaryFramework?.id ?? 'unknown',
    framework_version: primaryFramework?.detected.package?.version?.toString() ?? 'unknown',
    build_version: getNetlifyBuildVersion(),
  }
  const cleanedBody: Partial<typeof bodyToClean> =
    // @ts-expect-error FIXME(clean-deep): typings declare an ES `export default` but the package is CommonJS
    cleanDeep(bodyToClean)
  // cleanDeep deeply strips keys with empty strings, but empty strings are valid environment
  // variable values--a user can use an empty string to e.g. unset a variable only for a deploy.
  // This would result in payloads with a missing `value` key, which the API would reject.
  const body = environment?.length ? { ...cleanedBody, environment } : cleanedBody
  let deploy = (await api.updateSiteDeploy({
    siteId,
    deploy_id: deployId,
    // @ts-expect-error FIXME(@netlify/api): `functions_config` rejects zip-it-and-ship-it's `BuildData`, route `methods` and `traffic_rules` strings
    body,
  })) as DiffedDeploy

  if (async) deploy = (await waitForDiff(api, deployId, siteId, deployTimeout)) as DiffedDeploy

  const {
    required: requiredFiles,
    required_functions: requiredFns,
    required_edge_functions: requiredEdgeFns,
    required_server: requiredServer,
  } = deploy

  statusCb({
    type: 'create-deploy',
    msg: `CDN requesting ${(requiredFiles?.length ?? 0).toString()} files${
      Array.isArray(requiredFns) ? ` and ${requiredFns.length.toString()} functions` : ''
    }${Array.isArray(requiredEdgeFns) ? ` and ${requiredEdgeFns.length.toString()} edge functions` : ''}`,
    phase: 'stop',
  })

  const filesUploadList = getUploadList(requiredFiles, filesShaMap)
  const functionsUploadList = getUploadList(requiredFns, fnShaMap)
  const edgeFunctionsUploadList = getUploadList(requiredEdgeFns, edgeFnShaMap)
  const serverUploadList = getUploadList(requiredServer, serverShaMap)
  const uploadList = [...filesUploadList, ...functionsUploadList, ...edgeFunctionsUploadList, ...serverUploadList]

  await uploadFiles(api, deployId, uploadList, { concurrentUpload, statusCb, maxRetry })

  statusCb({
    type: 'wait-for-deploy',
    msg: 'Waiting for deploy to go live...',
    phase: 'start',
  })
  const readyDeploy = await waitForDeploy(api, deployId, siteId, deployTimeout)

  statusCb({
    type: 'wait-for-deploy',
    msg: draft ? 'Draft deploy is live!' : 'Deploy is live!',
    phase: 'stop',
  })

  await rm(tmpDir, { force: true, recursive: true })

  return {
    deployId,
    deploy: readyDeploy,
    uploadList,
  }
}
