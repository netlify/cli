// @ts-check
import { fileExistsAsync } from '../../lib/fs.mjs'

const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`

export const BACKGROUND = '-background'
const JS = 'js'

const addFunctionProps = ({ mainFile, name, runtime, schedule }) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground, schedule }
}

/**
 * @param {Record<string, { schedule?: string }>} functionConfigRecord
 * @returns {Record<string, { schedule?: string }>}
 */
const extractSchedule = (functionConfigRecord) =>
  Object.fromEntries(Object.entries(functionConfigRecord).map(([name, { schedule }]) => [name, { schedule }]))

export const getFunctions = async (functionsSrcDir, config = {}) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  const { listFunctions } = await import('@netlify/zip-it-and-ship-it')
  const functions = await listFunctions(functionsSrcDir, {
    config: config.functions ? extractSchedule(config.functions) : undefined,
    parseISC: true,
  })
  const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func))
  return functionsWithProps
}
