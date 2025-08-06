import { mkdir, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import path from 'path'

import { ARCHIVE_FORMAT, zipFunction, listFunction, type FunctionResult } from '@netlify/zip-it-and-ship-it'
// TODO(serhalp): Export this type from zisi
import type { FeatureFlags } from '@netlify/zip-it-and-ship-it/dist/feature_flags.js'
import { type MemoizeCache, memoize } from '@netlify/dev-utils'
import decache from 'decache'
import { readPackageUp } from 'read-package-up'
import sourceMapSupport from 'source-map-support'

import { NETLIFYDEVERR, type NormalizedCachedConfigConfig } from '../../../../../utils/command-helpers.js'
import { SERVE_FUNCTIONS_FOLDER } from '../../../../../utils/functions/functions.js'
import { getPathInProject } from '../../../../settings.js'
import { type NormalizedFunctionsConfig, normalizeFunctionsConfig } from '../../../config.js'
import type NetlifyFunction from '../../../netlify-function.js'
import type { BaseBuildResult } from '../../index.js'
import type { JsBuildResult } from '../index.js'

const require = createRequire(import.meta.url)

export type ZisiBuildResult = BaseBuildResult & {
  buildPath: string
  includedFiles: FunctionResult['includedFiles']
  outputModuleFormat: FunctionResult['outputModuleFormat']
  mainFile: FunctionResult['mainFile']
  runtimeAPIVersion: FunctionResult['runtimeAPIVersion']
}

const addFunctionsConfigDefaults = (config: NormalizedFunctionsConfig) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const buildFunction = async ({
  cache,
  config,
  featureFlags,
  func,
  hasTypeModule,
  projectRoot,
  targetDirectory,
}: {
  cache: MemoizeCache<FunctionResult>
  config: NormalizedFunctionsConfig
  featureFlags: FeatureFlags
  // This seems like it should be `ZisiBuildResult` but it's technically referenced from `detectZisiBuilder` so TS
  // can't know at that point that we'll only end up calling it with a `ZisiBuildResult`... Consider refactoring?
  func: NetlifyFunction<JsBuildResult>
  hasTypeModule: boolean
  projectRoot: string
  targetDirectory: string
}): Promise<ZisiBuildResult> => {
  const zipOptions = {
    archiveFormat: ARCHIVE_FORMAT.NONE,
    basePath: projectRoot,
    config,
    featureFlags: { ...featureFlags, zisi_functions_api_v2: true },
  }
  const {
    entryFilename,
    excludedRoutes,
    includedFiles,
    inputs,
    mainFile,
    outputModuleFormat,
    path: functionPath,
    routes,
    runtimeAPIVersion,
    schedule,
  } = await memoize({
    cache,
    cacheKey: `zisi-${func.srcPath}`,
    command: async () => {
      const result = await zipFunction(func.srcPath, targetDirectory, zipOptions)
      if (result == null) {
        throw new Error('Failed to build function')
      }
      return result
    },
  })
  const srcFiles = (inputs ?? []).filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, entryFilename)

  // some projects include a package.json with "type=module", forcing Node to interpret every descending file
  // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
  if (hasTypeModule) {
    await writeFile(
      path.join(functionPath, 'package.json'),
      JSON.stringify({
        type: 'commonjs',
      }),
    )
  }

  clearFunctionsCache(targetDirectory)

  return {
    buildPath,
    excludedRoutes,
    includedFiles,
    outputModuleFormat,
    mainFile,
    routes,
    runtimeAPIVersion,
    srcFiles,
    schedule,
  }
}

export const getFunctionMetadata = async ({
  config,
  mainFile,
  projectRoot,
}: {
  config: NormalizedCachedConfigConfig
  mainFile: string
  projectRoot: string
}) =>
  // TODO(serhalp): Throw if this returns `undefined`? It doesn't seem like this is expected.
  await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig({ config, projectRoot }),
    featureFlags: {},
    parseISC: true,
  })

type FunctionMetadata = NonNullable<Awaited<ReturnType<typeof getFunctionMetadata>>>

// Clears the cache for any files inside the directory from which functions are served.
const clearFunctionsCache = (functionsPath: string) => {
  Object.keys(require.cache)
    .filter((key) => key.startsWith(functionsPath))
    // @ts-expect-error(serhalp) -- `decache` is typed but TS thinks it isn't callable. Investigate.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- What in the world is going on?
    .forEach((key) => decache(key))
}

const getTargetDirectory = async ({
  errorExit,
  projectRoot,
}: {
  errorExit: (msg: string) => void
  projectRoot: string
}): Promise<string> => {
  const targetDirectory = path.resolve(projectRoot, getPathInProject([SERVE_FUNCTIONS_FOLDER]))

  try {
    await mkdir(targetDirectory, { recursive: true })
  } catch {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

const netlifyConfigToZisiConfig = ({
  config,
  projectRoot,
}: {
  config: NormalizedCachedConfigConfig
  projectRoot: string
}) => addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }))

export default async function detectZisiBuilder({
  config,
  errorExit,
  func,
  metadata,
  projectRoot,
}: {
  config: NormalizedCachedConfigConfig
  directory?: string | undefined
  errorExit: (msg: string) => void
  // This seems like it should be `ZisiBuildResult` but since we're "detecting" which builder to use here TS can't know
  // at that point that we'll only end up calling it with a `ZisiBuildResult`... Consider refactoring?
  func: NetlifyFunction<JsBuildResult>
  metadata?: FunctionMetadata | undefined
  projectRoot: string
}) {
  const functionsConfig = netlifyConfigToZisiConfig({ config, projectRoot })

  // @ts-expect-error(serhalp) -- We seem to be incorrectly using this function, but it seems to work... Investigate.
  const packageJson = await readPackageUp(func.mainFile)
  const hasTypeModule = packageJson?.packageJson.type === 'module'

  const featureFlags: FeatureFlags = {}

  if (metadata?.runtimeAPIVersion === 2) {
    featureFlags.zisi_pure_esm = true
    featureFlags.zisi_pure_esm_mjs = true
  } else {
    // We must use esbuild for certain file extensions.
    const mustTranspile = ['.mjs', '.ts', '.mts', '.cts'].includes(path.extname(func.mainFile))
    const mustUseEsbuild = hasTypeModule || mustTranspile

    if (mustUseEsbuild && !functionsConfig['*'].nodeBundler) {
      functionsConfig['*'].nodeBundler = 'esbuild'
    }

    // TODO: Resolve functions config globs so that we can check for the bundler
    // on a per-function basis.
    const isUsingEsbuild =
      functionsConfig['*'].nodeBundler != null && ['esbuild_zisi', 'esbuild'].includes(functionsConfig['*'].nodeBundler)

    if (!isUsingEsbuild) {
      return false
    }
  }

  // Enable source map support.
  sourceMapSupport.install()

  const targetDirectory = await getTargetDirectory({ projectRoot, errorExit })

  const build = async ({ cache = {} }: { cache?: MemoizeCache<FunctionResult> }) =>
    buildFunction({
      cache,
      config: functionsConfig,
      func,
      projectRoot,
      targetDirectory,
      hasTypeModule,
      featureFlags,
    })

  return {
    build,
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}
