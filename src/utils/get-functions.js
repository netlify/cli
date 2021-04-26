const { listFunctions } = require('@netlify/zip-it-and-ship-it')

const { fileExistsAsync } = require('../lib/fs')

const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`

const BACKGROUND = '-background'

const addFunctionProps = ({ mainFile, name, runtime }) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground }
}

const JS = 'js'

const getFunctions = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  const functions = await listFunctions(functionsSrcDir)
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))
  return functionsWithProps
}

const getFunctionsAndWatchDirs = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return { functions: [], watchDirs: [functionsSrcDir] }
  }

  // get all functions files so we know which directories to watch
  const functions = await listFunctions(functionsSrcDir)
  const watchDirs = [functionsSrcDir]

  // filter for only main files to serve
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))

  return { functions: functionsWithProps, watchDirs }
}

module.exports = { getFunctions, getFunctionsAndWatchDirs }
