const { relative } = require('path')
const process = require('process')

const { zipFunction, zipFunctions } = require('@netlify/zip-it-and-ship-it')
const chokidar = require('chokidar')
const debounce = require('lodash/debounce')
const makeDir = require('make-dir')

const { getPathInProject } = require('../lib/settings')

const { NETLIFYDEVERR, NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')

const getOnChangeFunction = ({ functionsConfig, functionsDirectory, log, targetDirectory }) => async (path, action) => {
  const relativePath = relative(functionsDirectory, path)

  log(`${NETLIFYDEVWARN} Function ${relativePath} ${action}, loading...`)

  try {
    await zipFunction(path, targetDirectory, {
      archiveFormat: 'none',
      functionsConfig,
    })

    log(`${NETLIFYDEVLOG} Function ${relativePath} loaded!`)
  } catch (error) {
    log(`${NETLIFYDEVERR} Function ${relativePath} has thrown an error: ${error.message}`)
  }
}

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionConfig = (functionConfig = {}) => ({
  externalNodeModules: functionConfig.external_node_modules,
  ignoredNodeModules: functionConfig.ignored_node_modules,
  nodeBundler: functionConfig.node_bundler,
})

const startFunctionBundler = async ({ functionsConfig = {}, functionsDirectory, log }) => {
  const targetDirectory = getPathInProject(['functions-serve'])
  const normalizedFunctionsConfig = Object.entries(functionsConfig).reduce(
    (result, [pattern, functionConfig]) => ({
      ...result,
      [pattern]: normalizeFunctionConfig(functionConfig),
    }),
    {},
  )

  log(`${NETLIFYDEVWARN} Bundling functions`)

  try {
    await makeDir(targetDirectory)
  } catch (error) {
    log(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)

    return
  }

  try {
    await zipFunctions(functionsDirectory, targetDirectory, {
      archiveFormat: 'none',
      config: normalizedFunctionsConfig,
    })
  } catch (error) {
    log(`${NETLIFYDEVERR} An error occurred during function bundling`)

    process.exit(1)
  }

  const onChange = debounce(
    getOnChangeFunction({ functionsConfig: normalizedFunctionsConfig, functionsDirectory, log, targetDirectory }),
    300,
  )

  startWatch({
    functionsDirectory,
    log,
    onChange,
    targetDirectory,
  })

  return {
    functionsDirectory: targetDirectory,
  }
}

const startWatch = ({ functionsDirectory, onChange }) => {
  const functionWatcher = chokidar.watch(functionsDirectory)

  functionWatcher.on('ready', () => {
    functionWatcher.on('add', (path) => {
      onChange(path, 'added')
    })
    functionWatcher.on('change', (path) => {
      onChange(path, 'changed')
    })
    // functionWatcher.on('unlink', debouncedBuild)
  })
}

module.exports = { startFunctionBundler }
