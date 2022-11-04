// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeF... Remove this comment to see the full error message
const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot, siteEnv = {} }: $TSFixMe) => Object.entries(functionsConfig).reduce((result, [pattern, config]) => ({
    ...result,
    [pattern]: {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        externalNodeModules: (config as $TSFixMe).external_node_modules,
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        includedFiles: (config as $TSFixMe).included_files,
        includedFilesBasePath: projectRoot,
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        ignoredNodeModules: (config as $TSFixMe).ignored_node_modules,
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        nodeBundler: (config as $TSFixMe).node_bundler === 'esbuild' ? 'esbuild_zisi' : (config as $TSFixMe).node_bundler,
        nodeVersion: siteEnv.AWS_LAMBDA_JS_RUNTIME,
        processDynamicNodeImports: true,
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        schedule: (config as $TSFixMe).schedule,
        zipGo: true,
    },
}), {});

module.exports = { normalizeFunctionsConfig }
