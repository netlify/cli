// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
export const normalizeFunctionsConfig = ({ functionsConfig = { '*': {} }, projectRoot, siteEnv = {}, }) => Object.entries(functionsConfig).reduce((result, [pattern, value]) => ({
    ...result,
    [pattern]: {
        externalNodeModules: 'external_node_modules' in value ? value.external_node_modules : undefined,
        includedFiles: value.included_files,
        includedFilesBasePath: projectRoot,
        ignoredNodeModules: 'ignored_node_modules' in value ? value.ignored_node_modules : undefined,
        nodeBundler: value.node_bundler === 'esbuild' ? 'esbuild_zisi' : value.node_bundler,
        nodeVersion: siteEnv.AWS_LAMBDA_JS_RUNTIME,
        processDynamicNodeImports: true,
        zipGo: true,
        // XXX(serhalp): Unnecessary check -- fixed in stack PR (bumps to https://github.com/netlify/build/pull/6165)
        schedule: 'schedule' in value ? value.schedule : undefined,
    },
}), { '*': {} });
//# sourceMappingURL=config.js.map