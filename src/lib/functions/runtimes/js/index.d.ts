export declare const name = "js";
export declare const getBuildFunction: ({ config, directory, errorExit, func, projectRoot }: {
    config: any;
    directory: any;
    errorExit: any;
    func: any;
    projectRoot: any;
}) => Promise<any>;
export declare const invokeFunction: ({ context, environment, event, func, timeout }: {
    context: any;
    environment: any;
    event: any;
    func: any;
    timeout: any;
}) => Promise<unknown>;
export declare const invokeFunctionDirectly: ({ context, event, func, timeout }: {
    context: any;
    event: any;
    func: any;
    timeout: any;
}) => Promise<unknown>;
export declare const onDirectoryScan: () => Promise<void>;
//# sourceMappingURL=index.d.ts.map