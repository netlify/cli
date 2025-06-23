import type { ExtendedRoute, Route } from '@netlify/zip-it-and-ship-it';
import type { BuildCommandCache } from '../memoized-build.js';
import type NetlifyFunction from '../netlify-function.js';
import type { NormalizedCachedConfigConfig } from '../../../utils/command-helpers.js';
import * as go from './go/index.js';
import type { GoInvokeFunctionResult } from './go/index.js';
import * as js from './js/index.js';
import type { JsInvokeFunctionResult } from './js/index.js';
import * as rust from './rust/index.js';
import type { RustInvokeFunctionResult } from './rust/index.js';
export type BaseBuildResult = {
    includedFiles?: undefined | string[];
    mainFile?: undefined | string;
    outputModuleFormat?: undefined | string;
    schedule?: undefined | string;
    srcFiles: string[];
    excludedRoutes?: Route[] | undefined;
    routes?: ExtendedRoute[] | undefined;
    runtimeAPIVersion?: number | undefined;
};
export type GetBuildFunctionOpts<BuildResult extends BaseBuildResult> = {
    config: NormalizedCachedConfigConfig;
    context?: Record<string, unknown>;
    directory?: string;
    errorExit: (msg: string) => void;
    func: NetlifyFunction<BuildResult>;
    functionsDirectory?: string;
    projectRoot: string;
};
export type BuildFunction<BuildResult extends BaseBuildResult, CacheEntry extends Record<string, unknown> = Record<string, unknown>> = ({ cache }: {
    cache?: BuildCommandCache<CacheEntry>;
}) => Promise<BuildResult>;
export type GetBuildFunction<BuildResult extends BaseBuildResult, CacheEntry extends Record<string, unknown> = Record<string, unknown>> = (params: GetBuildFunctionOpts<BuildResult>) => Promise<BuildFunction<BuildResult, CacheEntry>>;
export type InvokeFunctionResult = JsInvokeFunctionResult | GoInvokeFunctionResult | RustInvokeFunctionResult;
export type InvokeFunction<BuildResult extends BaseBuildResult> = (params: {
    context: Record<string, unknown>;
    environment: Record<string, unknown>;
    event: Record<string, unknown>;
    func: NetlifyFunction<BuildResult>;
    timeout: number;
}) => Promise<InvokeFunctionResult>;
export type OnRegisterFunction<BuildResult extends BaseBuildResult> = (func: NetlifyFunction<BuildResult>) => NetlifyFunction<BuildResult> | null;
export interface Runtime<BuildResult extends BaseBuildResult> {
    getBuildFunction: GetBuildFunction<BuildResult>;
    invokeFunction: InvokeFunction<BuildResult>;
    onRegister?: OnRegisterFunction<BuildResult>;
    name: string;
}
declare const runtimes: {
    go: typeof go;
    js: typeof js;
    rs: typeof rust;
};
export default runtimes;
//# sourceMappingURL=index.d.ts.map