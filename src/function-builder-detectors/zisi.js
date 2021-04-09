const path = require('path')

const { zipFunction, zipFunctions } = require('@netlify/zip-it-and-ship-it')
const makeDir = require('make-dir')

const { getPathInProject } = require('../lib/settings')
const { NETLIFYDEVERR } = require('../utils/logo')

const bundleFunctions = ({ config, sourceDirectory, targetDirectory, updatedPath }) => {
  // If `updatedPath` is truthy, it means we're running the build command due
  // to an update to a file. If that's the case, we run `zipFunction` to bundle
  // that specific function only.
  if (updatedPath) {
    return zipFunction(updatedPath, targetDirectory, {
      archiveFormat: 'none',
      config,
    })
  }

  return zipFunctions(sourceDirectory, targetDirectory, {
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
  const functionsConfig = normalizeFunctionsConfig(config.functions)
  const isUsingEsbuild = functionsConfig['*'] && functionsConfig['*'].nodeBundler === 'esbuild_zisi'

  if (!isUsingEsbuild) {
    return false
  }

  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: (updatedPath) => bundleFunctions({ config: functionsConfig, sourceDirectory, targetDirectory, updatedPath }),
    builderName: 'zip-it-and-ship-it',
    omitFileChangesLog: true,
    src: sourceDirectory,
    target: targetDirectory,
  }
}
