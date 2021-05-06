const path = require('path')

const { zipFunction, zipFunctions } = require('@netlify/zip-it-and-ship-it')
const del = require('del')
const makeDir = require('make-dir')
const pFilter = require('p-filter')
const sourceMapSupport = require('source-map-support')

const { getPathInProject } = require('../lib/settings')
const { getFunctions } = require('../utils/get-functions')
const { NETLIFYDEVERR } = require('../utils/logo')

const ZIP_CONCURRENCY = 5
const ZIP_DEBOUNCE_INTERVAL = 300

const addFunctionsConfigDefaults = (config) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const addFunctionToTree = (func, fileTree) => {
  // Transforming the inputs into a Set so that we can have a O(1) lookup.
  const inputs = new Set(func.inputs)

  // The `mainFile` property returned from ZISI will point to the original main
  // function file, but we want to serve the bundled version, which we set as
  // the `bundleFile` property.
  const bundleFile = path.join(func.path, `${func.name}.js`)

  fileTree.set(func.mainFile, { ...func, bundleFile, inputs })
}

// `memoizedZip` will avoid zipping the same function multiple times until the
// previous operation has been completed. If another call is made within that
// period, it will be:
// - discarded if it happens before `DEBOUNCE_WAIT` has elapsed;
// - enqueued if it happens after `DEBOUNCE_WAIT` has elapsed.
// This allows us to discard any duplicate filesystem events, while ensuring
// that actual updates happening during the zip operation will be executed
// after it finishes (only the last update will run).
const memoizedZip = ({ cacheKey, command, zipCache }) => {
  if (zipCache[cacheKey] === undefined) {
    zipCache[cacheKey] = {
      task: command().finally(() => {
        const entry = zipCache[cacheKey]

        zipCache[cacheKey] = undefined

        if (entry.enqueued !== undefined) {
          memoizedZip({ cacheKey, command, zipCache })
        }
      }),
      timestamp: Date.now(),
    }
  } else if (Date.now() > zipCache[cacheKey].timestamp + ZIP_DEBOUNCE_INTERVAL) {
    zipCache[cacheKey].enqueued = true
  }

  return zipCache[cacheKey].task
}

const zipFunctionsAndUpdateTree = async ({
  fileTree,
  functions,
  sourceDirectory,
  targetDirectory,
  zipCache,
  zipOptions,
}) => {
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
        const func = await memoizedZip({
          cacheKey: entryPath,
          command: () => zipFunction(entryPath, targetDirectory, zipOptions),
          zipCache,
        })

        addFunctionToTree(func, fileTree)
      },
      { concurrency: ZIP_CONCURRENCY },
    )

    return
  }

  const result = await memoizedZip({
    command: () => zipFunctions(sourceDirectory, targetDirectory, zipOptions),
    zipCache,
  })

  result.forEach((func) => {
    addFunctionToTree(func, fileTree)
  })
}

// Bundles a set of functions based on the event type and the updated path. It
// returns an array with the paths of the functions that were rebundled as a
// result of the update event.
const bundleFunctions = async ({
  config,
  eventType,
  fileTree,
  sourceDirectory,
  targetDirectory,
  updatedPath,
  zipCache,
}) => {
  const zipOptions = {
    archiveFormat: 'none',
    config,
  }

  if (eventType === 'add') {
    // We first check to see if the file being added is associated with any
    // functions (e.g. restoring a file that has been previously deleted).
    // If that's the case, we bundle just those functions.
    const functionsWithPath = [...fileTree.entries()].filter(([, { inputs }]) => inputs.has(updatedPath))

    if (functionsWithPath.length !== 0) {
      await zipFunctionsAndUpdateTree({
        fileTree,
        functions: functionsWithPath.map(([, func]) => func),
        sourceDirectory,
        targetDirectory,
        zipCache,
        zipOptions,
      })

      return functionsWithPath.map(([mainFile]) => mainFile)
    }

    // We then check whether the newly-added file is itself a function. If so,
    // we bundle it.
    const functions = await getFunctions(sourceDirectory)
    const matchingFunction = functions.find(({ mainFile }) => mainFile === updatedPath)

    if (matchingFunction !== undefined) {
      await zipFunctionsAndUpdateTree({
        fileTree,
        functions: [matchingFunction],
        sourceDirectory,
        targetDirectory,
        zipCache,
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
    if (fileTree.has(updatedPath)) {
      const matchingFunction = fileTree.get(updatedPath)

      // We bundle the function if this is a `change` event, or delete it if
      // the event is `unlink`.
      if (eventType === 'change') {
        await zipFunctionsAndUpdateTree({
          fileTree,
          functions: [matchingFunction],
          sourceDirectory,
          targetDirectory,
          zipCache,
          zipOptions,
        })
      } else {
        const { path: functionPath } = matchingFunction

        fileTree.delete(updatedPath)

        await del(functionPath, { force: true })
      }

      return [updatedPath]
    }

    // The update is in one of the supporting files. We bundle every function
    // that uses it.
    const functions = [...fileTree.entries()].filter(([, { inputs }]) => inputs.has(updatedPath))

    await zipFunctionsAndUpdateTree({
      fileTree,
      functions: functions.map(([, func]) => func),
      sourceDirectory,
      targetDirectory,
      zipCache,
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
  await zipFunctionsAndUpdateTree({
    fileTree,
    sourceDirectory,
    targetDirectory,
    zipCache,
    zipOptions,
  })
}

const getFunctionByName = ({ cache, name }) => [...cache.values()].find((func) => func.name === name)

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot }) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        includedFiles: config.included_files,
        includedFilesBasePath: projectRoot,
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

module.exports = async function handler({ config, errorExit, functionsDirectory: sourceDirectory, projectRoot }) {
  const functions = await getFunctions(sourceDirectory)
  const hasTSFunction = functions.some(({ mainFile }) => path.extname(mainFile) === '.ts')
  const functionsConfig = addFunctionsConfigDefaults(
    normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }),
  )
  const isUsingEsbuild = functionsConfig['*'].nodeBundler === 'esbuild_zisi'

  if (!hasTSFunction && !isUsingEsbuild) {
    return false
  }

  // Enable source map support.
  sourceMapSupport.install()

  // Keeps track of which files are associated with each function.
  const fileTree = new Map()

  // Used for memoizing calls to ZISI, such that we don't bundle the same
  // function multiple times at the same time.
  const zipCache = {}
  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: (updatedPath, eventType) =>
      bundleFunctions({
        config: functionsConfig,
        eventType,
        fileTree,
        sourceDirectory,
        targetDirectory,
        updatedPath,
        zipCache,
      }),
    builderName: 'zip-it-and-ship-it',
    getFunctionByName: (name) => getFunctionByName({ cache: fileTree, name }),
    src: sourceDirectory,
    target: targetDirectory,
  }
}

module.exports.normalizeFunctionsConfig = normalizeFunctionsConfig
