import type { LambdaEvent } from 'lambda-local';
import type { BaseBuildResult, BuildFunction, GetBuildFunctionOpts, InvokeFunction, OnRegisterFunction } from '../index.js';
export declare const name = "rs";
export type RustBuildResult = BaseBuildResult & {
    binaryPath: string;
};
export type RustInvokeFunctionResult = LambdaEvent;
export declare const getBuildFunction: ({ func, }: GetBuildFunctionOpts<RustBuildResult>) => Promise<BuildFunction<RustBuildResult>>;
export declare const invokeFunction: InvokeFunction<RustBuildResult>;
export declare const onRegister: OnRegisterFunction<RustBuildResult>;
//# sourceMappingURL=index.d.ts.map