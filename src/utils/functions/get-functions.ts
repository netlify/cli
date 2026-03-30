import { listFunctions, type ListedFunction } from '@netlify/zip-it-and-ship-it'

import { fileExistsAsync } from '../../lib/fs.js'

const getUrlPath = (functionName: string) => `/.netlify/functions/${functionName}`

export const BACKGROUND = '-background'
const JS = 'js'

const addFunctionProps = ({
  mainFile,
  name,
  runtime,
  schedule,
}: Pick<ListedFunction, 'mainFile' | 'name' | 'runtime' | 'schedule'>) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground, schedule }
}

/**
 * @param {Record<string, { schedule?: string }>} functionConfigRecord
 * @returns {Record<string, { schedule?: string }>}
 */
const extractSchedule = (functionConfigRecord: Record<string, { schedule?: string }>) =>
  Object.fromEntries(
    Object.entries(functionConfigRecord).map(([name, config]) => [name, { schedule: config.schedule }]),
  )

export const getFunctions = async (functionsSrcDir: string, config: { functions?: Record<string, unknown> } = {}) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  const functions = await listFunctions(functionsSrcDir, {
    config: config.functions ? extractSchedule(config.functions as Record<string, { schedule?: string }>) : undefined,
    parseISC: true,
  })
  const functionsWithProps = functions
    .filter((func): func is ListedFunction & { runtime: typeof JS } => func.runtime === JS)
    .map((func) => addFunctionProps(func))
  return functionsWithProps
}
