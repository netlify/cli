import { readFile } from 'fs/promises'
import path, { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

import { SERVER_DIRECTORY } from '@netlify/build'
import {
  findServerEntry,
  zipFunctions,
  zipServer,
  type FunctionResult,
  type TrafficRules,
} from '@netlify/zip-it-and-ship-it'

import type BaseCommand from '../../commands/base-command.js'
import type { $TSFixMe } from '../../commands/types.js'
import { INTERNAL_FUNCTIONS_FOLDER } from '../functions/functions.js'

import { hasherCtor, manifestCollectorCtor } from './hasher-segments.js'
import type { StatusCallback } from './status-cb.js'
import type { ServerUploadFile } from './upload-files.js'

// Maximum age of functions manifest (2 minutes).
const MANIFEST_FILE_TTL = 12e4

interface ServerBundle {
  path: string
  region?: string
}

const getFunctionZips = async ({
  command,
  directories,
  functionsConfig,
  manifestPath,
  rootDir,
  skipFunctionsCache,
  statusCb,
  tmpDir,
}: {
  command: BaseCommand
  directories: string[]
  functionsConfig?: $TSFixMe
  manifestPath: $TSFixMe
  rootDir: $TSFixMe
  skipFunctionsCache?: boolean | undefined
  statusCb: $TSFixMe
  tmpDir: $TSFixMe
}): Promise<(FunctionResult & { buildData?: unknown })[]> => {
  statusCb({
    type: 'functions-manifest',
    msg: 'Looking for a functions cache...',
    phase: 'start',
  })

  if (manifestPath) {
    try {
      const { functions, timestamp } = JSON.parse(await readFile(manifestPath, 'utf-8')) as {
        functions: (FunctionResult & { buildData?: unknown })[]
        timestamp: number
      }
      const manifestAge = Date.now() - timestamp

      if (manifestAge > MANIFEST_FILE_TTL) {
        throw new Error('Manifest expired')
      }

      statusCb({
        type: 'functions-manifest',
        msg: 'Deploying functions from cache (use --skip-functions-cache to override)',
        phase: 'stop',
      })

      return functions
    } catch {
      statusCb({
        type: 'functions-manifest',
        msg: 'Ignored invalid or expired functions cache',
        phase: 'stop',
      })
    }
  } else {
    const msg = skipFunctionsCache
      ? 'Ignoring functions cache (use without --skip-functions-cache to change)'
      : 'No cached functions were found'

    statusCb({
      type: 'functions-manifest',
      msg,
      phase: 'stop',
    })
  }

  return await zipFunctions(directories, tmpDir, {
    basePath: rootDir,
    configFileDirectories: [command.getPathInProject(INTERNAL_FUNCTIONS_FOLDER)],
    config: functionsConfig,
  })
}

const getServerBundle = async ({
  packagePath,
  rootDir,
  serverEnabled,
  serverManifestPath,
  tmpDir,
}: {
  packagePath?: string | undefined
  rootDir?: string | undefined
  serverEnabled?: boolean | undefined
  serverManifestPath?: string | undefined
  tmpDir: string
}): Promise<ServerBundle | undefined> => {
  if (!serverEnabled) {
    return undefined
  }

  if (serverManifestPath) {
    try {
      const { server, timestamp } = JSON.parse(await readFile(serverManifestPath, 'utf-8')) as {
        server?: ServerBundle
        timestamp: number
      }

      if (server && Date.now() - timestamp <= MANIFEST_FILE_TTL) {
        return server
      }
    } catch {
      // An unusable manifest is no different from not having one: the server is
      // rebuilt below.
    }
  }

  const entryPath = rootDir ? await findServerEntry(join(rootDir, packagePath ?? '', SERVER_DIRECTORY)) : undefined

  if (entryPath === undefined) {
    return undefined
  }

  return await zipServer(entryPath, join(tmpDir, 'server'), { basePath: rootDir })
}

const trafficRulesConfig = (trafficRules?: TrafficRules) => {
  if (!trafficRules) {
    return
  }

  return {
    action: {
      type: trafficRules?.action?.type,
      config: {
        rate_limit_config: {
          algorithm: trafficRules?.action?.config?.rateLimitConfig?.algorithm,
          window_size: trafficRules?.action?.config?.rateLimitConfig?.windowSize,
          window_limit: trafficRules?.action?.config?.rateLimitConfig?.windowLimit,
        },
        aggregate: trafficRules?.action?.config?.aggregate,
        to: trafficRules?.action?.config?.to,
      },
    },
  }
}

const hashFns = async (
  command: BaseCommand,
  directories: string[],
  {
    concurrentHash,
    functionsConfig,
    hashAlgorithm = 'sha256',
    manifestPath,
    packagePath,
    rootDir,
    serverEnabled,
    serverManifestPath,
    skipFunctionsCache,
    statusCb,
    tmpDir,
  }: {
    concurrentHash?: number
    functionsConfig?: $TSFixMe
    hashAlgorithm?: string | undefined
    manifestPath?: string | undefined
    packagePath?: string | undefined
    rootDir?: string | undefined
    serverEnabled?: boolean | undefined
    serverManifestPath?: string | undefined
    skipFunctionsCache?: boolean | undefined
    statusCb: $TSFixMe
    tmpDir: $TSFixMe
  },
): Promise<{
  functionSchedules?: { name: string; cron: string }[] | undefined
  functions: Record<string, string>
  functionsWithNativeModules: $TSFixMe[]
  shaMap?: Record<string, $TSFixMe> | undefined
  fnShaMap?: Record<string, $TSFixMe[]> | undefined
  fnConfig?: Record<string, $TSFixMe> | undefined
  server?: { sha: string; region?: string } | undefined
  serverShaMap?: Record<string, ServerUploadFile[]> | undefined
}> => {
  // Exit early if there is nothing to bundle. A site can have a server without
  // any functions directory.
  if (directories.length === 0 && !serverEnabled) {
    return { functions: {}, functionsWithNativeModules: [], shaMap: {} }
  }

  if (!tmpDir) {
    throw new Error('Missing tmpDir directory for zipping files')
  }

  const [functionZips, serverBundle] = await Promise.all([
    directories.length === 0
      ? []
      : getFunctionZips({
          command,
          directories,
          functionsConfig,
          manifestPath,
          rootDir,
          skipFunctionsCache,
          statusCb,
          tmpDir,
        }),
    getServerBundle({ packagePath, rootDir, serverEnabled, serverManifestPath, tmpDir }),
  ])

  // ZISI's in-memory FunctionResult only nests bootstrap/runtime version into
  // buildData when writing the manifest cache. Reconstruct it for direct-zip paths.
  for (const func of functionZips) {
    if (!func.buildData) {
      func.buildData = {
        bootstrapVersion: func.bootstrapVersion,
        runtimeAPIVersion: func.runtimeAPIVersion,
      }
    }
  }

  const fileObjs = functionZips.map(
    ({
      buildData,
      displayName,
      generator,
      invocationMode,
      path: functionPath,
      priority,
      runtime,
      runtimeVersion,
      timeout,
      trafficRules,
    }) => ({
      filepath: functionPath,
      root: tmpDir,
      relname: path.relative(tmpDir, functionPath),
      basename: path.basename(functionPath),
      extname: path.extname(functionPath),
      type: 'file',
      assetType: 'function',
      normalizedPath: path.basename(functionPath, path.extname(functionPath)),
      runtime: runtimeVersion ?? runtime,
      displayName,
      generator,
      invocationMode,
      timeout,
      buildData,
      priority,
      trafficRules,
    }),
  )
  const fnConfig = functionZips
    .filter((func) =>
      Boolean(
        func.displayName ||
        func.generator ||
        func.routes ||
        func.buildData ||
        func.priority ||
        func.trafficRules ||
        func.region ||
        func.memory ||
        func.vcpu,
      ),
    )
    .reduce(
      (funcs, curr) => ({
        ...funcs,
        [curr.name]: {
          display_name: curr.displayName,
          excluded_routes: curr.excludedRoutes,
          generator: curr.generator,
          memory: curr.memory,
          region: curr.region,
          routes: curr.routes,
          build_data: curr.buildData,
          priority: curr.priority,
          traffic_rules: trafficRulesConfig(curr.trafficRules),
          vcpu: curr.vcpu,
        },
      }),
      {},
    )
  const functionSchedules = functionZips
    .map(({ name, schedule }) => schedule && { name, cron: schedule })
    .filter((schedule) => schedule !== '' && schedule !== undefined)
  const functionsWithNativeModules = functionZips.filter(
    ({ nativeNodeModules }) => nativeNodeModules !== undefined && Object.keys(nativeNodeModules).length !== 0,
  )

  const functionStream = Readable.from(fileObjs)

  const hasher = hasherCtor({ concurrentHash, hashAlgorithm })

  // Written to by manifestCollector
  // normalizedPath: hash (wanted by deploy API)
  const functions = {}
  // hash: [fileObj, fileObj, fileObj]
  const fnShaMap = {}
  const manifestCollector = manifestCollectorCtor(functions, fnShaMap, { statusCb })

  await pipeline([functionStream, hasher, manifestCollector])

  const { server, serverShaMap } = await hashServer(serverBundle, { concurrentHash, hashAlgorithm, statusCb, tmpDir })

  return { functionSchedules, functions, functionsWithNativeModules, fnShaMap, fnConfig, server, serverShaMap }
}

// A deploy has at most one server, so it is declared on its own rather than in a
// map keyed by name. It still goes through the same hashing pipeline, so the
// upload flow can treat it like any other artifact.
const hashServer = async (
  serverBundle: ServerBundle | undefined,
  {
    concurrentHash,
    hashAlgorithm,
    statusCb,
    tmpDir,
  }: { concurrentHash?: number; hashAlgorithm?: string; statusCb: StatusCallback; tmpDir: string },
): Promise<{ server?: { sha: string; region?: string }; serverShaMap?: Record<string, ServerUploadFile[]> }> => {
  if (!serverBundle) {
    return {}
  }

  const fileObj = {
    filepath: serverBundle.path,
    root: tmpDir,
    relname: path.relative(tmpDir, serverBundle.path),
    basename: path.basename(serverBundle.path),
    extname: path.extname(serverBundle.path),
    type: 'file',
    assetType: 'server',
    normalizedPath: path.basename(serverBundle.path, path.extname(serverBundle.path)),
  }

  const servers: Record<string, string> = {}
  const serverShaMap: Record<string, ServerUploadFile[]> = {}

  await pipeline([
    Readable.from([fileObj]),
    hasherCtor({ concurrentHash, hashAlgorithm }),
    manifestCollectorCtor(servers, serverShaMap, { statusCb }),
  ])

  return { server: { sha: Object.values(servers)[0], region: serverBundle.region }, serverShaMap }
}

export default hashFns
