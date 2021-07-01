const { relative } = require('path')
const { cwd } = require('process')

const chalk = require('chalk')
const chokidar = require('chokidar')
const decache = require('decache')
const pEvent = require('p-event')

const { detectFunctionsBuilder } = require('../../utils/detect-functions-builder')
const { getFunctionsAndWatchDirs } = require('../../utils/get-functions')
const { NETLIFYDEVLOG } = require('../../utils/logo')

const { logBeforeAction, logAfterAction, validateFunctions } = require('./utils')
const { watchDebounced } = require('./watcher')

const getBuildFunction = ({ functionBuilder, log }) =>
  async function build(updatedPath, eventType) {
    const relativeFunctionsDir = relative(cwd(), functionBuilder.src)

    log(`${NETLIFYDEVLOG} ${chalk.magenta('Building')} functions from directory ${chalk.yellow(relativeFunctionsDir)}`)

    try {
      const functions = await functionBuilder.build(updatedPath, eventType)
      const functionNames = (functions || []).map((path) => relative(functionBuilder.src, path))

      // If the build command has returned a set of functions that have been
      // updated, the list them in the log message. If not, we show a generic
      // message with the functions directory.
      if (functionNames.length === 0) {
        log(
          `${NETLIFYDEVLOG} ${chalk.green('Finished')} building functions from directory ${chalk.yellow(
            relativeFunctionsDir,
          )}`,
        )
      } else {
        log(
          `${NETLIFYDEVLOG} ${chalk.green('Finished')} building functions: ${functionNames
            .map((name) => chalk.yellow(name))
            .join(', ')}`,
        )
      }
    } catch (error) {
      const errorMessage = (error.stderr && error.stderr.toString()) || error.message
      log(
        `${NETLIFYDEVLOG} ${chalk.red('Failed')} building functions from directory ${chalk.yellow(
          relativeFunctionsDir,
        )}${errorMessage ? ` with error:\n${errorMessage}` : ''}`,
      )
    }
  }

const setupDefaultFunctionHandler = async ({ capabilities, directory, warn }) => {
  const context = {
    functions: [],
    watchDirs: [],
  }
  const { functions, watchDirs } = await getFunctionsAndWatchDirs(directory)
  const onAdd = async (path) => {
    logBeforeAction({ path, action: 'added' })

    if (context.watchDirs.length !== 0) {
      await watcher.unwatch(watchDirs)
    }

    const { functions: newFunctions, watchDirs: newWatchDirs } = await getFunctionsAndWatchDirs(directory)

    validateFunctions({ functions, capabilities, warn })

    await watcher.add(newWatchDirs)

    context.functions = newFunctions
    context.watchDirs = newWatchDirs

    logAfterAction({ path, action: 'added' })
  }
  // Keeping the function here for clarity. This part of the code will be
  // refactored soon anyway.
  // eslint-disable-next-line unicorn/consistent-function-scoping
  const onChange = (path) => {
    logBeforeAction({ path, action: 'modified' })
    logAfterAction({ path, action: 'modified' })
  }
  const onUnlink = (path) => {
    logBeforeAction({ path, action: 'deleted' })

    context.functions = context.functions.filter((func) => func.mainFile !== path)

    logAfterAction({ path, action: 'deleted' })
  }
  const watcher = await watchDebounced(watchDirs, { onAdd, onChange, onUnlink })

  validateFunctions({ functions, capabilities, warn })

  context.functions = functions
  context.watchDirs = watchDirs

  const getFunctionByName = (functionName) => context.functions.find(({ name }) => name === functionName)

  return { getFunctionByName }
}

const setupFunctionsBuilder = async ({ config, errorExit, functionsDirectory, log, site }) => {
  const functionBuilder = await detectFunctionsBuilder({
    config,
    errorExit,
    functionsDirectory,
    log,
    projectRoot: site.root,
  })

  if (!functionBuilder) {
    return {}
  }

  const npmScriptString = functionBuilder.npmScript
    ? `: Running npm script ${chalk.yellow(functionBuilder.npmScript)}`
    : ''

  log(`${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} detected${npmScriptString}.`)

  const buildFunction = getBuildFunction({ functionBuilder, log })

  await buildFunction()

  const functionWatcher = chokidar.watch(functionBuilder.src)
  await pEvent(functionWatcher, 'ready')
  functionWatcher.on('add', (path) => buildFunction(path, 'add'))
  functionWatcher.on('change', async (path) => {
    await buildFunction(path, 'change')
    decache(path)
  })
  functionWatcher.on('unlink', (path) => buildFunction(path, 'unlink'))

  return functionBuilder
}

module.exports = { setupDefaultFunctionHandler, setupFunctionsBuilder }
