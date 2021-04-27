const path = require('path')

const { zipFunction, zipFunctions } = require('@netlify/zip-it-and-ship-it')
const del = require('del')
const makeDir = require('make-dir')
const pFilter = require('p-filter')

const { getPathInProject } = require('../lib/settings')
const { getFunctions } = require('../utils/get-functions')
const { NETLIFYDEVERR } = require('../utils/logo')

const ZIP_CONCURRENCY = 5

const addFunctionToCache = (func, cache) => {
  // Transforming the inputs into a Set so that we can have a O(1) lookup.
  const inputs = new Set(func.inputs)

  // The `mainFile` property returned from ZISI will point to the original main
  // function file, but we want to serve the bundled version, which we set as
  // the `bundleFile` property.
  const bundleFile = path.join(func.path, `${func.name}.js`)

  cache.set(func.mainFile, { ...func, bundleFile, inputs })
}

const zipFunctionsAndUpdateCache = async ({ cache, functions, sourceDirectory, targetDirectory, zipOptions }) => {
  if (functions !== undefined) {
    await pFilter(
      functions,
      async ({ mainFile }) => {
        const functionDirectory = path.dirname(mainFile)

        // If we have a function at `functions/my-func/index.js` and we pass
        // that path to `zipFunction`, it will lack the context of the whole
        // functions directory and will infer the name of the function to be
        // `index`, not `my-func`. Instead, we need to pass the directory of
        // the function. The exception is when the function is a file at the
        // root of the functions directory (e.g. `functions/my-func.js`). In
        // this case, we use `mainFile` as the function path of `zipFunction`.
        const entryPath = functionDirectory === sourceDirectory ? mainFile : functionDirectory
        const func = await zipFunction(entryPath, targetDirectory, zipOptions)

        addFunctionToCache(func, cache)
      },
      { concurrency: ZIP_CONCURRENCY },
    )

    return
  }

  const result = await zipFunctions(sourceDirectory, targetDirectory, zipOptions)

  result.forEach((func) => {
    addFunctionToCache(func, cache)
  })
}

// Bundles a set of functions based on the event type and the updated path. It
// returns an array with the paths of the functions that were rebundled as a
// result of the update event.
const bundleFunctions = async ({ cache, config, eventType, sourceDirectory, targetDirectory, updatedPath }) => {
  const zipOptions = {
    archiveFormat: 'none',
    config,
  }

  if (eventType === 'add') {
    // We first check to see if the file being added is associated with any
    // functions (e.g. restoring a file that has been previously deleted).
    // If that's the case, we bundle just those functions.
    const functionsWithPath = [...cache.entries()].filter(([, { inputs }]) => inputs.has(updatedPath))

    if (functionsWithPath.length !== 0) {
      await zipFunctionsAndUpdateCache({
        cache,
        functions: functionsWithPath.map(([, func]) => func),
        sourceDirectory,
        targetDirectory,
        zipOptions,
      })

      return functionsWithPath.map(([mainFile]) => mainFile)
    }

    // We then check whether the newly-added file is itself a function. If so,
    // we bundle it.
    const functions = await getFunctions(sourceDirectory)
    const matchingFunction = functions.find(({ mainFile }) => mainFile === updatedPath)

    if (matchingFunction !== undefined) {
      await zipFunctionsAndUpdateCache({
        cache,
        functions: [matchingFunction],
        sourceDirectory,
        targetDirectory,
        zipOptions,
      })

      return [updatedPath]
    }

    // At this point, the newly-added file is neither a function nor a file
    // associated with a function, so we can discard the update.
    return
  }

  if (eventType === 'change' || eventType === 'unlink') {
    // If the file matches a function's main file, we just need to operate on
    // that one function.
    if (cache.has(updatedPath)) {
      const matchingFunction = cache.get(updatedPath)

      // We bundle the function if this is a `change` event, or delete it if
      // the event is `unlink`.
      if (eventType === 'change') {
        await zipFunctionsAndUpdateCache({
          cache,
          functions: [matchingFunction],
          sourceDirectory,
          targetDirectory,
          zipOptions,
        })
      } else {
        const { path: functionPath } = matchingFunction

        cache.delete(updatedPath)

        await del(functionPath, { force: true })
      }

      return [updatedPath]
    }

    // The update is in one of the supporting files. We bundle every function
    // that uses it.
    const functions = [...cache.entries()].filter(([, { inputs }]) => inputs.has(updatedPath))

    await zipFunctionsAndUpdateCache({
      cache,
      functions: functions.map(([, func]) => func),
      sourceDirectory,
      targetDirectory,
      zipOptions,
    })

    return functions.map(([mainFile]) => mainFile)
  }

  // Deleting the target directory so that we can start from a clean slate.
  try {
    await del(targetDirectory, { force: true })
  } catch (_) {
    // no-op
  }

  // Bundling all functions.
  await zipFunctionsAndUpdateCache({
    cache,
    sourceDirectory,
    targetDirectory,
    zipOptions,
  })
}

const getFunctionByName = ({ cache, name }) => [...cache.values()].find((func) => func.name === name)

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionsConfig = (functionsConfig = {}) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        ignoredNodeModules: config.ignored_node_modules,
        nodeBundler: config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler,
      },
    }),
    {},
  )

const getTargetDirectory = async ({ errorExit }) => {
  const targetDirectory = path.resolve(getPathInProject(['functions-serve']))

  try {
    await makeDir(targetDirectory)
  } catch (error) {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

module.exports = async function handler({ config, errorExit, functionsDirectory: sourceDirectory }) {
  const functions = await getFunctions(sourceDirectory)
  const hasTSFunction = functions.some(({ mainFile }) => path.extname(mainFile) === '.ts')
  const functionsConfig = normalizeFunctionsConfig(config.functions)
  const isUsingEsbuild = functionsConfig['*'] && functionsConfig['*'].nodeBundler === 'esbuild_zisi'

  if (!hasTSFunction && !isUsingEsbuild) {
    return false
  }

  // This map will be used to keep track of which files are associated with
  // each function.
  const cache = new Map()
  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: (updatedPath, eventType) =>
      bundleFunctions({ cache, config: functionsConfig, eventType, sourceDirectory, targetDirectory, updatedPath }),
    builderName: 'zip-it-and-ship-it',
    getFunctionByName: (name) => getFunctionByName({ cache, name }),
    src: sourceDirectory,
    target: targetDirectory,
  }
}
