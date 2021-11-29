const { F_OK } = require('fs')
const { access } = require('fs/promises')

const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`

const BACKGROUND = '-background'

const addFunctionProps = ({ mainFile, name, runtime }) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground }
}

const JS = 'js'

const getFunctions = async (functionsSrcDir) => {
  if (!(await access(functionsSrcDir, F_OK))) {
    return []
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  // eslint-disable-next-line node/global-require
  const { listFunctions } = require('@netlify/zip-it-and-ship-it')
  const functions = await listFunctions(functionsSrcDir)
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))
  return functionsWithProps
}

const getFunctionsAndWatchDirs = async (functionsSrcDir) => {
  if (!(await access(functionsSrcDir, F_OK))) {
    return { functions: [], watchDirs: [functionsSrcDir] }
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  // eslint-disable-next-line node/global-require
  const { listFunctions } = require('@netlify/zip-it-and-ship-it')

  // get all functions files so we know which directories to watch
  const functions = await listFunctions(functionsSrcDir)
  const watchDirs = [functionsSrcDir]

  // filter for only main files to serve
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))

  return { functions: functionsWithProps, watchDirs }
}

module.exports = { getFunctions, getFunctionsAndWatchDirs, BACKGROUND }
