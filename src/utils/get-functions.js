const path = require('path')

const { listFunctions, listFunctionsFiles } = require('@netlify/zip-it-and-ship-it')

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

const getWatchDirs = (functionsSrcDir, functions) => {
  const localFilesDirs = functions
    .filter(({ srcFile }) => !srcFile.startsWith(functionsSrcDir) && !srcFile.includes('node_modules'))
    .map(({ srcFile }) => path.dirname(srcFile))

  return [functionsSrcDir, ...new Set(localFilesDirs)]
}

const getFunctionsAndWatchDirs = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return { functions: [], watchDirs: [functionsSrcDir] }
  }

  // get all functions files so we know which directories to watch
  const functions = await listFunctionsFiles(functionsSrcDir)
  const watchDirs = getWatchDirs(functionsSrcDir, functions)

  // filter for only main files to serve
  const functionsWithProps = functions
    .filter(({ runtime, srcFile, mainFile }) => runtime === JS && srcFile === mainFile)
    .map((func) => addFunctionProps(func))

  return { functions: functionsWithProps, watchDirs }
}

module.exports = { getFunctions, getFunctionsAndWatchDirs }
