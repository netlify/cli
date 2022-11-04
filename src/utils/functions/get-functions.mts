// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const { fileExistsAsync } = require('../../lib/fs.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getUrlPath = (functionName: $TSFixMe) => `/.netlify/functions/${functionName}`

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'BACKGROUND... Remove this comment to see the full error message
const BACKGROUND = '-background'

const addFunctionProps = ({
  mainFile,
  name,
  runtime,
  schedule
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const urlPath = getUrlPath(name)
  const isBackground = name.endsWith(BACKGROUND)
  return { mainFile, name, runtime, urlPath, isBackground, schedule }
}

const JS = 'js'

/**
 * @param {Record<string, { schedule?: string }>} functionConfigRecord
 * @returns {Record<string, { schedule?: string }>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const extractSchedule = (functionConfigRecord: $TSFixMe) => Object.fromEntries(Object.entries(functionConfigRecord).map(([name, { schedule }]) => [name, { schedule }]))

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getFunctio... Remove this comment to see the full error message
const getFunctions = async (functionsSrcDir: $TSFixMe, config = {}) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return []
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  const { listFunctions } = await import('@netlify/zip-it-and-ship-it')
  const functions = await listFunctions(functionsSrcDir, {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    config: (config as $TSFixMe).functions ? extractSchedule((config as $TSFixMe).functions) : undefined,
    parseISC: true,
});
  const functionsWithProps = functions.filter(({
    runtime
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => runtime === JS).map((func: $TSFixMe) => addFunctionProps(func))
  return functionsWithProps
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getFunctionsAndWatchDirs = async (functionsSrcDir: $TSFixMe) => {
  if (!(await fileExistsAsync(functionsSrcDir))) {
    return { functions: [], watchDirs: [functionsSrcDir] }
  }

  // performance optimization, load '@netlify/zip-it-and-ship-it' on demand
  const { listFunctions } = await import('@netlify/zip-it-and-ship-it')

  // get all functions files so we know which directories to watch
  const functions = await listFunctions(functionsSrcDir)
  const watchDirs = [functionsSrcDir]

  // filter for only main files to serve
  const functionsWithProps = functions.filter(({
    runtime
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => runtime === JS).map((func: $TSFixMe) => addFunctionProps(func))

  return { functions: functionsWithProps, watchDirs }
}

module.exports = { getFunctions, getFunctionsAndWatchDirs, BACKGROUND }
