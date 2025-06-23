import { mkdir, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { ARCHIVE_FORMAT, zipFunction, listFunction } from '@netlify/zip-it-and-ship-it';
import decache from 'decache';
import { readPackageUp } from 'read-package-up';
import sourceMapSupport from 'source-map-support';
import { NETLIFYDEVERR } from '../../../../../utils/command-helpers.js';
import { SERVE_FUNCTIONS_FOLDER } from '../../../../../utils/functions/functions.js';
import { getPathInProject } from '../../../../settings.js';
import { normalizeFunctionsConfig } from '../../../config.js';
import { memoizedBuild } from '../../../memoized-build.js';
const require = createRequire(import.meta.url);
const addFunctionsConfigDefaults = (config) => ({
    ...config,
    '*': {
        nodeSourcemap: true,
        ...config['*'],
    },
});
const buildFunction = async ({ cache, config, directory, featureFlags, func, hasTypeModule, projectRoot, targetDirectory, }) => {
    const zipOptions = {
        archiveFormat: ARCHIVE_FORMAT.NONE,
        basePath: projectRoot,
        config,
        featureFlags: { ...featureFlags, zisi_functions_api_v2: true },
    };
    const functionDirectory = path.dirname(func.mainFile);
    // If we have a function at `functions/my-func/index.js` and we pass
    // that path to `zipFunction`, it will lack the context of the whole
    // functions directory and will infer the name of the function to be
    // `index`, not `my-func`. Instead, we need to pass the directory of
    // the function. The exception is when the function is a file at the
    // root of the functions directory (e.g. `functions/my-func.js`). In
    // this case, we use `mainFile` as the function path of `zipFunction`.
    const entryPath = functionDirectory === directory ? func.mainFile : functionDirectory;
    const { entryFilename, excludedRoutes, includedFiles, inputs, mainFile, outputModuleFormat, path: functionPath, routes, runtimeAPIVersion, schedule, } = await memoizedBuild({
        cache,
        cacheKey: `zisi-${entryPath}`,
        command: async () => {
            const result = await zipFunction(entryPath, targetDirectory, zipOptions);
            if (result == null) {
                throw new Error('Failed to build function');
            }
            return result;
        },
    });
    const srcFiles = (inputs ?? []).filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`));
    const buildPath = path.join(functionPath, entryFilename);
    // some projects include a package.json with "type=module", forcing Node to interpret every descending file
    // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
    if (hasTypeModule) {
        await writeFile(path.join(functionPath, 'package.json'), JSON.stringify({
            type: 'commonjs',
        }));
    }
    clearFunctionsCache(targetDirectory);
    return {
        buildPath,
        excludedRoutes,
        includedFiles,
        outputModuleFormat,
        mainFile,
        routes,
        runtimeAPIVersion,
        srcFiles,
        schedule,
    };
};
export const getFunctionMetadata = async ({ config, mainFile, projectRoot, }) => 
// TODO(serhalp): Throw if this returns `undefined`? It doesn't seem like this is expected.
await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig({ config, projectRoot }),
    featureFlags: {},
    parseISC: true,
});
// Clears the cache for any files inside the directory from which functions are served.
const clearFunctionsCache = (functionsPath) => {
    Object.keys(require.cache)
        .filter((key) => key.startsWith(functionsPath))
        // @ts-expect-error(serhalp) -- `decache` is typed but TS thinks it isn't callable. Investigate.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- What in the world is going on?
        .forEach((key) => decache(key));
};
const getTargetDirectory = async ({ errorExit, projectRoot, }) => {
    const targetDirectory = path.resolve(projectRoot, getPathInProject([SERVE_FUNCTIONS_FOLDER]));
    try {
        await mkdir(targetDirectory, { recursive: true });
    }
    catch {
        errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`);
    }
    return targetDirectory;
};
const netlifyConfigToZisiConfig = ({ config, projectRoot, }) => addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }));
export default async function detectZisiBuilder({ config, directory, errorExit, func, metadata, projectRoot, }) {
    const functionsConfig = netlifyConfigToZisiConfig({ config, projectRoot });
    // @ts-expect-error(serhalp) -- We seem to be incorrectly using this function, but it seems to work... Investigate.
    const packageJson = await readPackageUp(func.mainFile);
    const hasTypeModule = packageJson?.packageJson.type === 'module';
    const featureFlags = {};
    if (metadata?.runtimeAPIVersion === 2) {
        featureFlags.zisi_pure_esm = true;
        featureFlags.zisi_pure_esm_mjs = true;
    }
    else {
        // We must use esbuild for certain file extensions.
        const mustTranspile = ['.mjs', '.ts', '.mts', '.cts'].includes(path.extname(func.mainFile));
        const mustUseEsbuild = hasTypeModule || mustTranspile;
        if (mustUseEsbuild && !functionsConfig['*'].nodeBundler) {
            functionsConfig['*'].nodeBundler = 'esbuild';
        }
        // TODO: Resolve functions config globs so that we can check for the bundler
        // on a per-function basis.
        const isUsingEsbuild = functionsConfig['*'].nodeBundler != null && ['esbuild_zisi', 'esbuild'].includes(functionsConfig['*'].nodeBundler);
        if (!isUsingEsbuild) {
            return false;
        }
    }
    // Enable source map support.
    sourceMapSupport.install();
    const targetDirectory = await getTargetDirectory({ projectRoot, errorExit });
    const build = async ({ cache = {} }) => buildFunction({
        cache,
        config: functionsConfig,
        directory,
        func,
        projectRoot,
        targetDirectory,
        hasTypeModule,
        featureFlags,
    });
    return {
        build,
        builderName: 'zip-it-and-ship-it',
        target: targetDirectory,
    };
}
//# sourceMappingURL=zisi.js.map