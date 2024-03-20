import { mkdir, writeFile } from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { zipFunction, listFunction } from '@netlify/zip-it-and-ship-it';
import decache from 'decache';
import { readPackageUp } from 'read-pkg-up';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'sour... Remove this comment to see the full error message
import sourceMapSupport from 'source-map-support';
import { NETLIFYDEVERR } from '../../../../../utils/command-helpers.js';
import { SERVE_FUNCTIONS_FOLDER } from '../../../../../utils/functions/functions.js';
import { getPathInProject } from '../../../../settings.js';
import { normalizeFunctionsConfig } from '../../../config.js';
import { memoizedBuild } from '../../../memoized-build.js';
const require = createRequire(import.meta.url);
// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
const addFunctionsConfigDefaults = (config) => ({
    ...config,
    '*': {
        nodeSourcemap: true,
        ...config['*'],
    },
});
/**
 * @param {object} params
 * @param {import("@netlify/zip-it-and-ship-it/dist/feature_flags.js").FeatureFlags} params.featureFlags
 */
const buildFunction = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'cache' implicitly has an 'any' ty... Remove this comment to see the full error message
cache, 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'directory' implicitly has an 'any... Remove this comment to see the full error message
directory, 
// @ts-expect-error TS(7031) FIXME: Binding element 'featureFlags' implicitly has an '... Remove this comment to see the full error message
featureFlags, 
// @ts-expect-error TS(7031) FIXME: Binding element 'func' implicitly has an 'any' typ... Remove this comment to see the full error message
func, 
// @ts-expect-error TS(7031) FIXME: Binding element 'hasTypeModule' implicitly has an ... Remove this comment to see the full error message
hasTypeModule, 
// @ts-expect-error TS(7031) FIXME: Binding element 'projectRoot' implicitly has an 'a... Remove this comment to see the full error message
projectRoot, 
// @ts-expect-error TS(7031) FIXME: Binding element 'targetDirectory' implicitly has a... Remove this comment to see the full error message
targetDirectory, }) => {
    const zipOptions = {
        archiveFormat: 'none',
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
    const { entryFilename, includedFiles, inputs, mainFile, outputModuleFormat, path: functionPath, routes, runtimeAPIVersion, schedule, } = await memoizedBuild({
        cache,
        cacheKey: `zisi-${entryPath}`,
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ archiveFormat: string; basePat... Remove this comment to see the full error message
        command: () => zipFunction(entryPath, targetDirectory, zipOptions),
    });
    // @ts-expect-error TS(7006) FIXME: Parameter 'inputPath' implicitly has an 'any' type... Remove this comment to see the full error message
    const srcFiles = inputs.filter((inputPath) => !inputPath.includes(`${path.sep}node_modules${path.sep}`));
    const buildPath = path.join(functionPath, entryFilename);
    // some projects include a package.json with "type=module", forcing Node to interpret every descending file
    // as ESM. ZISI outputs CJS, so we emit an overriding directive into the output directory.
    if (hasTypeModule) {
        await writeFile(path.join(functionPath, `package.json`), JSON.stringify({
            type: 'commonjs',
        }));
    }
    clearFunctionsCache(targetDirectory);
    return { buildPath, includedFiles, outputModuleFormat, mainFile, routes, runtimeAPIVersion, srcFiles, schedule };
};
/**
 * @param {object} params
 * @param {unknown} params.config
 * @param {string} params.mainFile
 * @param {string} params.projectRoot
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const parseFunctionForMetadata = async ({ config, mainFile, projectRoot }) => await listFunction(mainFile, {
    config: netlifyConfigToZisiConfig({ config, projectRoot }),
    // @ts-expect-error TS(2322) FIXME: Type '{ zisi_functions_api_v2: true; }' is not ass... Remove this comment to see the full error message
    featureFlags: { zisi_functions_api_v2: true },
    parseISC: true,
});
// Clears the cache for any files inside the directory from which functions are
// served.
// @ts-expect-error TS(7006) FIXME: Parameter 'functionsPath' implicitly has an 'any' ... Remove this comment to see the full error message
const clearFunctionsCache = (functionsPath) => {
    Object.keys(require.cache)
        .filter((key) => key.startsWith(functionsPath))
        // @ts-expect-error
        .forEach(decache);
};
/**
 *
 * @param {object} config
 * @param {string} config.projectRoot
 * @param {(msg: string) => void} config.errorExit
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'errorExit' implicitly has an 'any... Remove this comment to see the full error message
const getTargetDirectory = async ({ errorExit, projectRoot }) => {
    const targetDirectory = path.resolve(projectRoot, getPathInProject([SERVE_FUNCTIONS_FOLDER]));
    try {
        await mkdir(targetDirectory, { recursive: true });
    }
    catch {
        errorExit(`${NETLIFYDEVERR} Could not create directory: ${targetDirectory}`);
    }
    return targetDirectory;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
const netlifyConfigToZisiConfig = ({ config, projectRoot }) => addFunctionsConfigDefaults(normalizeFunctionsConfig({ functionsConfig: config.functions, projectRoot }));
/**
 *
 * @param {object} param0
 * @param {*} param0.config
 * @param {*} param0.directory
 * @param {*} param0.errorExit
 * @param {*} param0.func
 * @param {*} param0.metadata
 * @param {string} param0.projectRoot
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export default async function handler({ config, directory, errorExit, func, metadata, projectRoot }) {
    const functionsConfig = netlifyConfigToZisiConfig({ config, projectRoot });
    const packageJson = await readPackageUp(func.mainFile);
    const hasTypeModule = packageJson && packageJson.packageJson.type === 'module';
    /** @type {import("@netlify/zip-it-and-ship-it/dist/feature_flags.js").FeatureFlags} */
    const featureFlags = {};
    if (metadata.runtimeAPIVersion === 2) {
        // @ts-expect-error TS(2339) FIXME: Property 'zisi_pure_esm' does not exist on type '{... Remove this comment to see the full error message
        featureFlags.zisi_pure_esm = true;
        // @ts-expect-error TS(2339) FIXME: Property 'zisi_pure_esm_mjs' does not exist on typ... Remove this comment to see the full error message
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
        const isUsingEsbuild = ['esbuild_zisi', 'esbuild'].includes(functionsConfig['*'].nodeBundler);
        if (!isUsingEsbuild) {
            return false;
        }
    }
    // Enable source map support.
    sourceMapSupport.install();
    const targetDirectory = await getTargetDirectory({ projectRoot, errorExit });
    return {
        build: ({ cache = {} }) => buildFunction({
            cache,
            config: functionsConfig,
            directory,
            func,
            projectRoot,
            targetDirectory,
            hasTypeModule,
            featureFlags,
        }),
        builderName: 'zip-it-and-ship-it',
        target: targetDirectory,
    };
}
