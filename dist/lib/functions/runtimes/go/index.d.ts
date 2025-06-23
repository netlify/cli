import type { LambdaEvent } from 'lambda-local';
import type { BaseBuildResult, BuildFunction, GetBuildFunctionOpts, InvokeFunction, OnRegisterFunction } from '../index.js';
export declare const name = "go";
export type GoBuildResult = BaseBuildResult & {
    binaryPath: string;
};
export type GoInvokeFunctionResult = LambdaEvent;
export declare const getBuildFunction: ({ func, }: GetBuildFunctionOpts<GoBuildResult>) => Promise<BuildFunction<GoBuildResult>>;
export declare const invokeFunction: InvokeFunction<GoBuildResult>;
export declare const onRegister: OnRegisterFunction<GoBuildResult>;
//# sourceMappingURL=index.d.ts.map