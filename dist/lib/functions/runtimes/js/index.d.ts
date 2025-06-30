import { type LambdaEvent } from 'lambda-local';
import type { BuildFunction, GetBuildFunction, InvokeFunction } from '../index.js';
import type NetlifyFunction from '../../netlify-function.js';
import { ZisiBuildResult } from './builders/zisi.js';
import type { WorkerMessage } from './worker.js';
export declare const name = "js";
type SimpleJsBuildResult = {
    schedule?: string;
    srcFiles: string[];
};
export type JsBuildResult = ZisiBuildResult | SimpleJsBuildResult;
export type JsInvokeFunctionResult = WorkerMessage | LambdaEvent;
export declare function getBuildFunction({ config, directory, errorExit, func, projectRoot, }: Parameters<GetBuildFunction<JsBuildResult>>[0]): Promise<(({ cache }: {
    cache?: import("../../memoized-build.js").BuildCommandCache<import("@netlify/zip-it-and-ship-it").FunctionResult>;
}) => Promise<ZisiBuildResult>) | BuildFunction<JsBuildResult>>;
export declare const invokeFunction: ({ context, environment, event, func, timeout, }: Parameters<InvokeFunction<JsBuildResult>>[0]) => Promise<JsInvokeFunctionResult>;
export declare const invokeFunctionDirectly: <BuildResult extends JsBuildResult>({ context, environment, event, func, timeout, }: {
    context: Record<string, unknown>;
    environment: Record<string, string>;
    event: Record<string, unknown>;
    func: NetlifyFunction<BuildResult>;
    timeout: number;
}) => Promise<LambdaEvent>;
export {};
//# sourceMappingURL=index.d.ts.map