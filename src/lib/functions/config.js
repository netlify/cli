// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
// @ts-expect-error TS(7031) FIXME: Binding element 'projectRoot' implicitly has an 'a... Remove this comment to see the full error message
export const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot, siteEnv = {} }) => Object.entries(functionsConfig).reduce((result, [pattern, config]) => ({
    ...result,
    [pattern]: {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        externalNodeModules: config.external_node_modules,
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        includedFiles: config.included_files,
        includedFilesBasePath: projectRoot,
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        ignoredNodeModules: config.ignored_node_modules,
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        nodeBundler: config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler,
        // @ts-expect-error TS(2339) FIXME: Property 'AWS_LAMBDA_JS_RUNTIME' does not exist on... Remove this comment to see the full error message
        nodeVersion: siteEnv.AWS_LAMBDA_JS_RUNTIME,
        processDynamicNodeImports: true,
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        schedule: config.schedule,
        zipGo: true,
    },
}), {});
