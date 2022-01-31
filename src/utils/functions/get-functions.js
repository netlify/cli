// @ts-check
const { fileExistsAsync } = require('../../lib/fs')

const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`

const BACKGROUND = '-background'

const addFunctionProps = ({ mainFile, name, runtime, schedule }) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground, schedule }
}

const JS = 'js'

/**
 * @param {Record<string, { schedule?: string }>} functionConfigRecord
 * @returns {Record<string, { schedule?: string }>}
 */
const extractSchedule = (functionConfigRecord) =>
  Object.fromEntries(Object.entries(functionConfigRecord).map(([name, { schedule }]) => [name, { schedule }]))

const getFunctions = async (functionsSrcDir, config = {}) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  // eslint-disable-next-line node/global-require
  const { listFunctions } = require('@netlify/zip-it-and-ship-it')
  const functions = await listFunctions(functionsSrcDir, {
    config: config.functions ? extractSchedule(config.functions) : undefined,
    parseISC: true,
  })
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))
  return functionsWithProps
}

const getFunctionsAndWatchDirs = async (functionsSrcDir) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
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
