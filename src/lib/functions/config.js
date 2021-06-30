// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
const normalizeFunctionsConfig = ({ functionsConfig = {}, projectRoot }) =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, config]) => ({
      ...result,
      [pattern]: {
        externalNodeModules: config.external_node_modules,
        experimentalHandlerV2: true,
        includedFiles: config.included_files,
        includedFilesBasePath: projectRoot,
        ignoredNodeModules: config.ignored_node_modules,
        nodeBundler: config.node_bundler === 'esbuild' ? 'esbuild_zisi' : config.node_bundler,
      },
    }),
    {},
  )

module.exports = { normalizeFunctionsConfig }
