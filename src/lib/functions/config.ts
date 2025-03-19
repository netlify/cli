import type { NetlifyConfig } from '@netlify/build'
import type { NodeBundlerName } from '@netlify/zip-it-and-ship-it'

export interface NormalizedFunctionConfigObject {
  externalNodeModules?: undefined | string[]
  includedFiles?: undefined | string[]
  includedFilesBasePath: string
  ignoredNodeModules?: undefined | string[]
  nodeBundler?: undefined | NodeBundlerName
  nodeVersion?: undefined | string
  processDynamicNodeImports: true
  zipGo: true
  schedule?: undefined | string
}

export type NormalizedFunctionsConfig = {
  '*': NormalizedFunctionConfigObject
  [pattern: string]: NormalizedFunctionConfigObject
}

// The function configuration keys returned by @netlify/config are not an exact
// match to the properties that @netlify/zip-it-and-ship-it expects. We do that
// translation here.
export const normalizeFunctionsConfig = ({
  functionsConfig = { '*': {} },
  projectRoot,
  siteEnv = {},
}: {
  functionsConfig?: NetlifyConfig['functions']
  projectRoot: string
  siteEnv?: Record<string, undefined | string>
}): NormalizedFunctionsConfig =>
  Object.entries(functionsConfig).reduce(
    (result, [pattern, value]): NormalizedFunctionsConfig => ({
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
        // XXX remove after bumping netlify/build
        schedule: 'schedule' in value ? (value.schedule as undefined | string) : undefined,
      },
    }),
    { '*': {} } as NormalizedFunctionsConfig,
  )
