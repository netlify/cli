// @ts-check
import { fileExistsAsync } from '../../lib/fs.js'

export const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`

export const BACKGROUND = '-background'

const addFunctionProps = ({ mainFile, name, runtime }) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground }
}

const JS = 'js'

export const getFunctions = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  const { listFunctions } = await import('@netlify/zip-it-and-ship-it')
  const functions = await listFunctions(functionsSrcDir)
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))
  return functionsWithProps
}

export const getFunctionsAndWatchDirs = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return { functions: [], watchDirs: [functionsSrcDir] }
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  const { listFunctions } = await import('@netlify/zip-it-and-ship-it')

  // get all functions files so we know which directories to watch
  const functions = await listFunctions(functionsSrcDir)
  const watchDirs = [functionsSrcDir]

  // filter for only main files to serve
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))

  return { functions: functionsWithProps, watchDirs }
}
