import { FunctionsRegistry } from '../../../../src/lib/functions/registry.js'
import NetlifyFunction from '../../../../src/lib/functions/netlify-function.js'
import type { BaseBuildResult, Runtime } from '../../../../src/lib/functions/runtimes/index.js'
import { getFrameworksAPIPaths } from '../../../../src/utils/frameworks-api.js'
import { createConfig } from '../../../integration/utils/config.js'

type FunctionsRegistryOptions = ConstructorParameters<typeof FunctionsRegistry>[0]
type NetlifyFunctionOptions<BuildResult extends BaseBuildResult> = ConstructorParameters<
  typeof NetlifyFunction<BuildResult>
>[0]

const blobsContext = {
  deployID: '0',
  edgeURL: 'http://localhost',
  primaryRegion: 'us-east-1',
  siteID: 'test-site',
  token: 'test-token',
  uncachedEdgeURL: 'http://localhost',
}

export const createFunctionsRegistry = ({
  projectRoot,
  ...overrides
}: Partial<FunctionsRegistryOptions> & { projectRoot: string }) =>
  new FunctionsRegistry({
    blobsContext,
    capabilities: {},
    config: createConfig(),
    deployEnvironment: [],
    frameworksAPIPaths: getFrameworksAPIPaths(projectRoot),
    generatedFunctions: [],
    logLambdaCompat: false,
    projectRoot,
    settings: { functionsPort: 8888 },
    timeouts: { backgroundFunctions: 1, syncFunctions: 1 },
    ...overrides,
  })

export const createNetlifyFunction = <BuildResult extends BaseBuildResult>(
  overrides: Partial<NetlifyFunctionOptions<BuildResult>> & { runtime: Runtime<BuildResult> },
) =>
  new NetlifyFunction<BuildResult>({
    blobsContext,
    config: createConfig(),
    deployEnvironment: [],
    mainFile: '',
    name: 'test-function',
    projectRoot: '/project-root',
    settings: { functionsPort: 8888 },
    srcPath: '',
    ...overrides,
  })
