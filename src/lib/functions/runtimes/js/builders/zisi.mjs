import { mkdir, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import path from 'path'

import decache from 'decache'
import readPkgUp from 'read-pkg-up'
import sourceMapSupport from 'source-map-support'

import { NETLIFYDEVERR } from '../../../../../utils/command-helpers.mjs'
import { SERVE_FUNCTIONS_FOLDER } from '../../../../../utils/functions/functions.mjs'
import { getPathInProject } from '../../../../settings.mjs'
import { normalizeFunctionsConfig } from '../../../config.mjs'
import { memoizedBuild } from '../../../memoized-build.mjs'

const require = createRequire(import.meta.url)

const addFunctionsConfigDefaults = (config) => ({
  ...config,
  '*': {
    nodeSourcemap: true,
    ...config['*'],
  },
})

const buildFunction = async ({ cache, config, directory, func, hasTypeModule, projectRoot, targetDirectory }) => {
  const zipOptions = {
    archiveFormat: 'none',
    basePath: projectRoot,
    config,
  }
  const functionDirectory = path.dirname(func.mainFile)

  // performance
  const { zipFunction } = await import('@netlify/zip-it-and-ship-it')

  // If we have a function at `functions/my-func/index.js` and we pass
  // that path to `zipFunction`, it will lack the context of the whole
  // functions directory and will infer the name of the function to be
  // `index`, not `my-func`. Instead, we need to pass the directory of
  // the function. The exception is when the function is a file at the
  // root of the functions directory (e.g. `functions/my-func.js`). In
  // this case, we use `mainFile` as the function path of `zipFunction`.
  const entryPath = functionDirectory === directory ? func.mainFile : functionDirectory
  const {
    includedFiles,
    inputs,
    path: functionPath,
    schedule,
  } = await memoizedBuild({
    cache,
    cacheKey: `zisi-${entryPath}`,
    command: () => zipFunction(entryPath, targetDirectory, zipOptions),
  })
  const srcFiles = inputs.filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`))
  const buildPath = path.join(functionPath, `${func.name}.js`)

  // some projects include a package.json with "type=module", forcing Node to interpret every descending file
  // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
  if (hasTypeModule) {
    await writeFile(
      path.join(functionPath, `package.json`),
      JSON.stringify({
        type: 'commonjs',
      }),
    )
  }

  clearFunctionsCache(targetDirectory)

  return { buildPath, includedFiles, srcFiles, schedule }
}

/**
 * @param {object} params
 * @param {unknown} params.config
 * @param {string} params.mainFile
 * @param {string} params.projectRoot
 */
export const parseForSchedule = async ({ config, mainFile, projectRoot }) => {
  const { listFunction } = await import('@netlify/zip-it-and-ship-it')
  const listedFunction = await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig({ config, projectRoot }),
    parseISC: true,
  })

  return listedFunction && listedFunction.schedule
}

// Clears the cache for any files inside the directory from which functions are
// served.
const clearFunctionsCache = (functionsPath) => {
  Object.keys(require.cache)
    .filter((key) => key.startsWith(functionsPath))
    .forEach(decache)
}

const getTargetDirectory = async ({ errorExit }) => {
  const targetDirectory = path.resolve(getPathInProject([SERVE_FUNCTIONS_FOLDER]))

  try {
    await mkdir(targetDirectory, { recursive: true })
  } catch {
    errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`)
  }

  return targetDirectory
}

const netlifyConfigToZisiConfig = ({ config, projectRoot }) =>
  addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }))

export default async function handler({ config, directory, errorExit, func, projectRoot }) {
  const functionsConfig = netlifyConfigToZisiConfig({ config, projectRoot })

  const packageJson = await readPkgUp(func.mainFile)
  const hasTypeModule = packageJson && packageJson.packageJson.type === 'module'

  // We must use esbuild for certain file extensions.
  const mustTranspile = ['.mjs', '.ts'].includes(path.extname(func.mainFile))
  const mustUseEsbuild = hasTypeModule || mustTranspile

  if (mustUseEsbuild && !functionsConfig['*'].nodeBundler) {
    functionsConfig['*'].nodeBundler = 'esbuild'
  }

  // TODO: Resolve functions config globs so that we can check for the bundler
  // on a per-function basis.
  const isUsingEsbuild = ['esbuild_zisi', 'esbuild'].includes(functionsConfig['*'].nodeBundler)

  if (!isUsingEsbuild) {
    return false
  }

  // Enable source map support.
  sourceMapSupport.install()

  const targetDirectory = await getTargetDirectory({ errorExit })

  return {
    build: ({ cache = {} }) =>
      buildFunction({ cache, config: functionsConfig, directory, func, projectRoot, targetDirectory, hasTypeModule }),
    builderName: 'zip-it-and-ship-it',
    target: targetDirectory,
  }
}
