const path = require('path')

const { zipFunction } = require('@netlify/zip-it-and-ship-it')
const makeDir = require('make-dir')
const sourceMapSupport = require('source-map-support')

const { getPathInProject } = require('../../../../settings')
const { NETLIFYDEVERR } = require('../../../../../utils/logo')

const { memoizedBuild } = require('../../../memoized-builder')

const addFunctionsConfigDefaults = (config) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const buildFunction = async ({ config, func, functionsDirectory, projectRoot, targetDirectory }) => {
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
    cacheKey: `zisi-${entryPath}`,
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })
  const srcFiles = inputs.filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, `${func.name}.js`)

  clearCacheForFunction(functionPath)

  return { buildPath, srcFiles }
}

const clearCacheForFunction = (functionPath) => {
  Object.keys(require.cache)
    .filter((path) => path.startsWith(functionPath))
    .forEach((path) => {
      delete require.cache[path]
    })
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

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot }) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        experimentalHandlerV2: true,
        includedFiles: config.included_files,
        includedFilesBasePath: projectRoot,
        ignoredNodeModules: config.ignored_node_modules,
        nodeBundler: config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler,
      },
    }),
    {},
  )

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
    build: (func) => buildFunction({ config: functionsConfig, func, functionsDirectory, projectRoot, targetDirectory }),
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}

module.exports.normalizeFunctionsConfig = normalizeFunctionsConfig
