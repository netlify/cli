import type { NetlifyConfig } from '@netlify/build'
import { type Config as ZisiConfig, type ListedFunction, listFunctions } from '@netlify/zip-it-and-ship-it'

import { fileExistsAsync } from '../../lib/fs.js'

const getUrlPath = (functionName: string) => `/.netlify/functions/${functionName}`

export const BACKGROUND = '-background'
const JS = 'js'

const addFunctionProps = ({ mainFile, name, runtime, schedule }: ListedFunction) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground, schedule }
}

export type LocalFunction = ReturnType<typeof addFunctionProps>

const extractSchedule = (functionsConfig: NetlifyConfig['functions']): ZisiConfig =>
  Object.fromEntries(
    // @ts-expect-error FIXME(@netlify/build): `schedule` is missing from the functions config type
    Object.entries(functionsConfig).map(([name, { schedule }]) => [name, { schedule }]),
  )

export const getFunctions = async (
  functionsSrcDir: string,
  config: { functions?: NetlifyConfig['functions'] | undefined } = {},
) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  const functions = await listFunctions(functionsSrcDir, {
    config: config.functions ? extractSchedule(config.functions) : undefined,
    parseISC: true,
  })
  return functions.filter(({ runtime }) => runtime === JS).map(addFunctionProps)
}
