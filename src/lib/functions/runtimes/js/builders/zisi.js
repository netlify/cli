const path = require('path')

const { zipFunction } = require('@netlify/zip-it-and-ship-it')
const decache = require('decache')
const findUp = require('find-up')
const makeDir = require('make-dir')
const sourceMapSupport = require('source-map-support')

const { NETLIFYDEVERR } = require('../../../../../utils/logo')
const { writeFileAsync, readFileAsync } = require('../../../../fs')
const { getPathInProject } = require('../../../../settings')
const { normalizeFunctionsConfig } = require('../../../config')
const { memoizedBuild } = require('../../../memoized-build')

/**
 * @param {string} filename
 * @returns {Promise<{ type: string } | null>}
 */
const readPkgUp = async (filename) => {
  const pkgPath = await findUp('package.json', { cwd: filename, type: 'file' })
  if (!pkgPath) {
    return null
  }

  try {
    const pkgString = await readFileAsync(pkgPath, { encoding: 'utf-8' })
    const pkg = JSON.parse(pkgString)
    return pkg
  } catch (error) {
    return null
  }
}

const addFunctionsConfigDefaults = (config) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const buildFunction = async ({ cache, config, directory, func, projectRoot, targetDirectory, hasTypeModule }) => {
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
  const entryPath = functionDirectory === directory ? func.mainFile : functionDirectory
  const { inputs, path: functionPath } = await memoizedBuild({
    cache,
    cacheKey: `zisi-${entryPath}`,
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })
  const srcFiles = inputs.filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, `${func.name}.js`)

  // some projects include a package.json with "type=module", forcing Node to interpret every descending file
  // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
  if (hasTypeModule) {
    await writeFileAsync(
      path.join(functionPath, `package.json`),
      JSON.stringify({
        type: 'commonjs',
      }),
    )
  }

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

module.exports = async ({ config, directory, errorExit, func, projectRoot }) => {
  const functionsConfig = addFunctionsConfigDefaults(
    normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }),
  )

  const packageJson = await readPkgUp(func.mainFile)
  const hasTypeModule = packageJson && packageJson.type === 'module'

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
