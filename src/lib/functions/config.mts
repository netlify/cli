// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.

const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot, siteEnv = {} }: $TSFixMe) => Object.entries(functionsConfig).reduce((result, [pattern, config]) => ({
    ...result,
    [pattern]: {
        
        externalNodeModules: (config as $TSFixMe).external_node_modules,
        
        includedFiles: (config as $TSFixMe).included_files,
        includedFilesBasePath: projectRoot,
        
        ignoredNodeModules: (config as $TSFixMe).ignored_node_modules,
        
        nodeBundler: (config as $TSFixMe).node_bundler === 'esbuild' ? 'esbuild_zisi' : (config as $TSFixMe).node_bundler,
        nodeVersion: siteEnv.AWS_LAMBDA_JS_RUNTIME,
        processDynamicNodeImports: true,
        
        schedule: (config as $TSFixMe).schedule,
        zipGo: true,
    },
}), {});

export default { normalizeFunctionsConfig }
