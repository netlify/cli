
const { mkdir, writeFile } = require('fs').promises

const path = require('path')


const decache = require('decache')
const readPkgUp = require('read-pkg-up')
const sourceMapSupport = require('source-map-support')


const { NETLIFYDEVERR } = require('../../../../../utils/index.mjs')

const { getPathInProject } = require('../../../../settings.cjs')

const { normalizeFunctionsConfig } = require('../../../config.cjs')

const { memoizedBuild } = require('../../../memoized-build.cjs')


const addFunctionsConfigDefaults = (config: $TSFixMe) => ({
  ...config,

  '*': {
    nodeSourcemap: true,
    ...config['*'],
  }
})

const buildFunction = async ({
  cache,
  config,
  directory,
  func,
  hasTypeModule,
  projectRoot,
  targetDirectory

}: $TSFixMe) => {
  const zipOptions = {
    archiveFormat: 'none',
    basePath: projectRoot,
    config,
  }
  const functionDirectory = path.dirname(func.mainFile)

  const { zipFunction } = await import('@netlify/zip-it-and-ship-it')

  // If we have a function at `functions/my-func/index.js` and we pass
  // that path to `zipFunction`, it will lack the context of the whole
  // functions directory and will infer the name of the function to be
  // `index`, not `my-func`. Instead, we need to pass the directory of
  // the function. The exception is when the function is a file at the
  // root of the functions directory (e.g. `functions/my-func.js`). In
  // this case, we use `mainFile` as the function path of `zipFunction`.
  const entryPath = functionDirectory === directory ? func.mainFile : functionDirectory
  const {
    includedFiles,
    inputs,
    path: functionPath,
    schedule,
  } = await memoizedBuild({
    cache,
    cacheKey: `zisi-${entryPath}`,
    // @ts-expect-error TS(2345): Argument of type '{ archiveFormat: string; basePat... Remove this comment to see the full error message
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })
  
  const srcFiles = inputs.filter((inputPath: $TSFixMe) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, `${func.name}.js`)

  // some projects include a package.json with "type=module", forcing Node to interpret every descending file
  // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
  if (hasTypeModule) {
    await writeFile(
      path.join(functionPath, `package.json`),
      JSON.stringify({
        type: 'commonjs',
      }),
    )
  }

  clearFunctionsCache(targetDirectory)

  return { buildPath, includedFiles, srcFiles, schedule }
}

/**
 * @param {object} params
 * @param {unknown} params.config
 * @param {string} params.mainFile
 * @param {string} params.projectRoot
 */
const parseForSchedule = async ({
  config,
  mainFile,
  projectRoot

}: $TSFixMe) => {
  const { listFunction } = await import('@netlify/zip-it-and-ship-it')
  const listedFunction = await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig({ config, projectRoot }),
    parseISC: true,
  })

  return listedFunction && listedFunction.schedule
}

// Clears the cache for any files inside the directory from which functions are
// served.

const clearFunctionsCache = (functionsPath: $TSFixMe) => {
  Object.keys(require.cache)
    .filter((key) => key.startsWith(functionsPath))
    .forEach(decache)
}

const getTargetDirectory = async ({
  errorExit

}: $TSFixMe) => {
  const targetDirectory = path.resolve(getPathInProject(['functions-serve']))

  try {
    await mkdir(targetDirectory, { recursive: true })
  } catch {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

const netlifyConfigToZisiConfig = ({
  config,
  projectRoot

}: $TSFixMe) =>
  addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }))

module.exports = async ({
  config,
  directory,
  errorExit,
  func,
  projectRoot

}: $TSFixMe) => {
  const functionsConfig = netlifyConfigToZisiConfig({ config, projectRoot })

  const packageJson = await readPkgUp(func.mainFile)
  const hasTypeModule = packageJson && packageJson.packageJson.type === 'module'

  // We must use esbuild for certain file extensions.
  const mustTranspile = ['.mjs', '.ts'].includes(path.extname(func.mainFile))
  const mustUseEsbuild = hasTypeModule || mustTranspile

  if (mustUseEsbuild && !functionsConfig['*'].nodeBundler) {
    functionsConfig['*'].nodeBundler = 'esbuild'
  }

  // TODO: Resolve functions config globs so that we can check for the bundler
  // on a per-function basis.
  const isUsingEsbuild = ['esbuild_zisi', 'esbuild'].includes(functionsConfig['*'].nodeBundler)

  if (!isUsingEsbuild) {
    return false
  }

  // Enable source map support.
  sourceMapSupport.install()

  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: ({ cache = {} }) =>
      buildFunction({ cache, config: functionsConfig, directory, func, projectRoot, targetDirectory, hasTypeModule }),
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}

module.exports.parseForSchedule = parseForSchedule
