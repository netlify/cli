const path = require('path')

const { zipFunction } = require('@netlify/zip-it-and-ship-it')
const decache = require('decache')
const makeDir = require('make-dir')
const sourceMapSupport = require('source-map-support')

const { NETLIFYDEVERR } = require('../../../../../utils/logo')
const { getPathInProject } = require('../../../../settings')
const { normalizeFunctionsConfig } = require('../../../config')
const { memoizedBuild } = require('../../../memoized-build')

const addFunctionsConfigDefaults = (config) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const buildFunction = async ({ cache, config, func, functionsDirectory, projectRoot, targetDirectory }) => {
  const zipOptions = {
    archiveFormat: 'none',
    basePath: projectRoot,
    config,
  }
  const functionDirectory = path.dirname(func.mainFile)

  // If we have a function at `functions/my-func/index.js` and we pass
  // that path to `zipFunction`, it will lack the context of the whole
  // functions directory and will infer the name of the function to be
  // `index`, not `my-func`. Instead, we need to pass the directory of
  // the function. The exception is when the function is a file at the
  // root of the functions directory (e.g. `functions/my-func.js`). In
  // this case, we use `mainFile` as the function path of `zipFunction`.
  const entryPath = functionDirectory === functionsDirectory ? func.mainFile : functionDirectory
  const { inputs, path: functionPath } = await memoizedBuild({
    cache,
    cacheKey: `zisi-${entryPath}`,
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })
  const srcFiles = inputs.filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, `${func.name}.js`)

  clearFunctionsCache(targetDirectory)

  return { buildPath, srcFiles }
}

// Clears the cache for any files inside the directory from which functions are
// served.
const clearFunctionsCache = (functionsPath) => {
  Object.keys(require.cache)
    .filter((key) => key.startsWith(functionsPath))
    .forEach(decache)
}

const getTargetDirectory = async ({ errorExit }) => {
  const targetDirectory = path.resolve(getPathInProject(['functions-serve']))

  try {
    await makeDir(targetDirectory)
  } catch (error) {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

module.exports = async ({ config, errorExit, func, functionsDirectory, projectRoot }) => {
  const isTSFunction = path.extname(func.mainFile) === '.ts'
  const functionsConfig = addFunctionsConfigDefaults(
    normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }),
  )

  // TODO: Resolve functions config globs so that we can check for the bundler
  // on a per-function basis.
  const isUsingEsbuild = functionsConfig['*'].nodeBundler === 'esbuild_zisi'

  if (!isTSFunction && !isUsingEsbuild) {
    return false
  }

  // Enable source map support.
  sourceMapSupport.install()

  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: ({ cache = {} }) =>
      buildFunction({ cache, config: functionsConfig, func, functionsDirectory, projectRoot, targetDirectory }),
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}
