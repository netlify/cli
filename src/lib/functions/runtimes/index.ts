import type { ExtendedRoute, FunctionResult, Route } from '@netlify/zip-it-and-ship-it'
import type { MemoizeCache } from '@netlify/dev-utils'

import type NetlifyFunction from '../netlify-function.js'
import type { NormalizedCachedConfigConfig } from '../../../utils/command-helpers.js'

import * as go from './go/index.js'
import type { GoInvokeFunctionResult } from './go/index.js'
import * as js from './js/index.js'
import type { JsInvokeFunctionResult } from './js/index.js'
import * as rust from './rust/index.js'
import type { RustInvokeFunctionResult } from './rust/index.js'

export type BaseBuildResult = {
  includedFiles?: undefined | string[]
  mainFile?: undefined | string
  outputModuleFormat?: undefined | string
  schedule?: undefined | string
  srcFiles: string[]

  // TODO(serhalp): This module and type shouldn't know about these zisi types. Refactor to allow the JS runtime's zisi
  // builder to define this on its extended base build result type.
  excludedRoutes?: Route[] | undefined
  invocationMode?: string | undefined
  routes?: ExtendedRoute[] | undefined
  runtimeAPIVersion?: number | undefined
}

export type GetBuildFunctionOpts<BuildResult extends BaseBuildResult> = {
  config: NormalizedCachedConfigConfig
  context?: Record<string, unknown>
  directory?: string
  errorExit: (msg: string) => void
  func: NetlifyFunction<BuildResult>
  functionsDirectory?: string
  projectRoot: string
}
// Shared by all functions in a registry. Only the JS runtime's ZISI builder uses it for now.
export type BuildCache = MemoizeCache<FunctionResult>
export type BuildFunction<BuildResult extends BaseBuildResult> = ({
  cache,
}: {
  cache?: BuildCache
}) => Promise<BuildResult>
export type GetBuildFunction<BuildResult extends BaseBuildResult> = (
  params: GetBuildFunctionOpts<BuildResult>,
) => Promise<BuildFunction<BuildResult>>

// TODO(serhalp): It's inconsistent that this uses a union but `BuildResult` uses generics. Consider refactoring.
// eslint-disable-next-line @typescript-eslint/no-duplicate-type-constituents
export type InvokeFunctionResult = JsInvokeFunctionResult | GoInvokeFunctionResult | RustInvokeFunctionResult
export type InvokeFunction<BuildResult extends BaseBuildResult> = (params: {
  context: Record<string, unknown>
  environment: Record<string, string>
  event: Record<string, unknown>
  func: NetlifyFunction<BuildResult>
  timeout: number
}) => Promise<InvokeFunctionResult>

export type OnRegisterFunction<BuildResult extends BaseBuildResult> = (
  func: NetlifyFunction<BuildResult>,
) => NetlifyFunction<BuildResult> | null

// Methods (rather than function properties) make `BuildResult` bivariant here, so that any runtime is assignable to
// `Runtime<BaseBuildResult>`. This is sound as long as a runtime is only handed functions it built itself.
export interface Runtime<BuildResult extends BaseBuildResult> {
  getBuildFunction(...args: Parameters<GetBuildFunction<BuildResult>>): ReturnType<GetBuildFunction<BuildResult>>
  invokeFunction(...args: Parameters<InvokeFunction<BuildResult>>): ReturnType<InvokeFunction<BuildResult>>
  onRegister?(...args: Parameters<OnRegisterFunction<BuildResult>>): ReturnType<OnRegisterFunction<BuildResult>>
  name: string
}

const runtimes = {
  [go.name]: go,
  [js.name]: js,
  [rust.name]: rust,
}

export const isSupportedRuntime = (runtimeName: string): runtimeName is keyof typeof runtimes =>
  Object.hasOwn(runtimes, runtimeName)

export default runtimes
