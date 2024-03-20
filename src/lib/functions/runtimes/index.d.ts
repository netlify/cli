import * as go from './go/index.js';
import * as js from './js/index.js';
import * as rust from './rust/index.js';
type BuildFunction = (func: object) => Promise<{
    srcFiles: string[];
    buildPath?: string;
}>;
type GetBuildFunction = (params: {
    config: object;
    context: object;
    errorExit: Function;
    func: object;
    functionsDirectory: string;
    projectRoot: string;
}) => Promise<BuildFunction>;
type InvokeFunction = (params: {
    context: object;
    event: object;
    func: object;
    timeout: number;
}) => Promise<{
    body: object;
    statusCode: number;
}>;
type OnDirectoryScanFunction = (params: {
    directory: string;
}) => Promise<void>;
type OnRegisterFunction = (func: object) => Promise<object | null>;
export interface Runtime {
    getBuildFunction: GetBuildFunction;
    invokeFunction: InvokeFunction;
    onDirectoryScan?: OnDirectoryScanFunction;
    onRegister?: OnRegisterFunction;
    name: string;
}
declare const runtimes: {
    go: typeof go;
    js: typeof js;
    rs: typeof rust;
};
export default runtimes;
//# sourceMappingURL=index.d.ts.map