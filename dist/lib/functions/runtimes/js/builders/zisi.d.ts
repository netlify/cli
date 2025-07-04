import { type FunctionResult } from '@netlify/zip-it-and-ship-it';
import { type NormalizedCachedConfigConfig } from '../../../../../utils/command-helpers.js';
import { type BuildCommandCache } from '../../../memoized-build.js';
import type NetlifyFunction from '../../../netlify-function.js';
import type { BaseBuildResult } from '../../index.js';
import type { JsBuildResult } from '../index.js';
export type ZisiBuildResult = BaseBuildResult & {
    buildPath: string;
    includedFiles: FunctionResult['includedFiles'];
    outputModuleFormat: FunctionResult['outputModuleFormat'];
    mainFile: FunctionResult['mainFile'];
    runtimeAPIVersion: FunctionResult['runtimeAPIVersion'];
};
export declare const getFunctionMetadata: ({ config, mainFile, projectRoot, }: {
    config: NormalizedCachedConfigConfig;
    mainFile: string;
    projectRoot: string;
}) => Promise<import("@netlify/zip-it-and-ship-it").ListedFunction | undefined>;
type FunctionMetadata = NonNullable<Awaited<ReturnType<typeof getFunctionMetadata>>>;
export default function detectZisiBuilder({ config, directory, errorExit, func, metadata, projectRoot, }: {
    config: NormalizedCachedConfigConfig;
    directory?: string | undefined;
    errorExit: (msg: string) => void;
    func: NetlifyFunction<JsBuildResult>;
    metadata?: FunctionMetadata | undefined;
    projectRoot: string;
}): Promise<false | {
    build: ({ cache }: {
        cache?: BuildCommandCache<FunctionResult>;
    }) => Promise<ZisiBuildResult>;
    builderName: string;
    target: string;
}>;
export {};
//# sourceMappingURL=zisi.d.ts.map