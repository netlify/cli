const path = require('path')

const { zipFunctions } = require('@netlify/zip-it-and-ship-it')
const del = require('del')
const makeDir = require('make-dir')

const { getPathInProject } = require('../lib/settings')
const { getFunctions } = require('../utils/get-functions')
const { NETLIFYDEVERR } = require('../utils/logo')

const bundleFunctions = async ({ config, sourceDirectory, targetDirectory }) => {
  // @todo Build only the functions affected by the path that has changed.
  await zipFunctions(sourceDirectory, targetDirectory, {
    archiveFormat: 'none',
    config,
  })
}

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionsConfig = (functionsConfig = {}) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        ignoredNodeModules: config.ignored_node_modules,
        nodeBundler: config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler,
      },
    }),
    {},
  )

const getTargetDirectory = async ({ errorExit }) => {
  const targetDirectory = path.resolve(getPathInProject(['functions-serve']))

  try {
    await makeDir(targetDirectory)
  } catch (error) {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

module.exports = async function handler({ config, errorExit, functionsDirectory: sourceDirectory }) {
  const functions = await getFunctions(sourceDirectory)
  const hasTSFunction = functions.some(({ mainFile }) => path.extname(mainFile) === '.ts')
  const functionsConfig = normalizeFunctionsConfig(config.functions)
  const isUsingEsbuild = functionsConfig['*'] && functionsConfig['*'].nodeBundler === 'esbuild_zisi'

  if (!hasTSFunction && !isUsingEsbuild) {
    return false
  }

  const targetDirectory = await getTargetDirectory({ errorExit })

  // Emptying the directory from which functions will be served, to clear any
  // deleted functions from a previous run.
  try {
    await del(targetDirectory, { force: true })
  } catch (_) {
    // no-op
  }

  return {
    build: (updatedPath) => bundleFunctions({ config: functionsConfig, sourceDirectory, targetDirectory, updatedPath }),
    builderName: 'zip-it-and-ship-it',
    omitFileChangesLog: true,
    src: sourceDirectory,
    target: targetDirectory,
  }
}
