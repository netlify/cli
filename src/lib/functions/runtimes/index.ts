import type { PatchedConfig } from '../../../commands/types.js'
import type { BuildCommandCache } from '../memoized-build.js'
import type NetlifyFunction from '../netlify-function.js'
import * as go from './go/index.js'
import * as js from './js/index.js'
import * as rust from './rust/index.js'

export type BaseBuildResult = {
  srcFiles: string[]
  includedFiles?: undefined | string[]
  schedule?: undefined | string
  excludedRoutes?: undefined | unknown[]
  outputModuleFormat?: undefined | string
  mainFile?: undefined | string
  routes?: undefined | unknown[]
}

export type GetBuildFunctionOpts<BuildResult extends BaseBuildResult> = {
  config: PatchedConfig
  context?: Record<string, unknown>
  directory?: string
  errorExit: (msg: string) => void
  func: NetlifyFunction<BuildResult>
  functionsDirectory?: string
  projectRoot: string
}
export type BuildFunction<BuildResult extends BaseBuildResult> = ({
  cache,
}: {
  cache?: BuildCommandCache<BuildResult>
}) => Promise<BuildResult>
export type GetBuildFunction<BuildResult extends BaseBuildResult> = (
  params: GetBuildFunctionOpts<BuildResult>,
) => Promise<BuildFunction<BuildResult>>

export type InvokeFunction<BuildResult extends BaseBuildResult> = (params: {
  context: Record<string, unknown>
  environment: Record<string, unknown>
  event: Record<string, unknown>
  func: NetlifyFunction<BuildResult>
  timeout: number
}) => Promise<{ body?: unknown; statusCode: number }>

export type OnDirectoryScanFunction = (params: { directory: string }) => Promise<void>

export type OnRegisterFunction<BuildResult extends BaseBuildResult> = (
  func: NetlifyFunction<BuildResult>,
) => NetlifyFunction<BuildResult> | null

export interface Runtime<BuildResult extends BaseBuildResult> {
  getBuildFunction: GetBuildFunction<BuildResult>
  invokeFunction: InvokeFunction<BuildResult>
  onDirectoryScan?: OnDirectoryScanFunction
  onRegister?: OnRegisterFunction<BuildResult>
  name: string
}

const runtimes = {
  [go.name]: go,
  [js.name]: js,
  [rust.name]: rust,
}

export default runtimes
