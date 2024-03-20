export declare const name = "go";
export declare const getBuildFunction: ({ func }: {
    func: any;
}) => () => Promise<{
    binaryPath: any;
    srcFiles: any[];
}>;
export declare const invokeFunction: ({ context, event, func, timeout }: {
    context: any;
    event: any;
    func: any;
    timeout: any;
}) => Promise<{
    body: any;
    headers: any;
    multiValueHeaders: any;
    statusCode: any;
} | {
    statusCode: number;
    body?: undefined;
    headers?: undefined;
    multiValueHeaders?: undefined;
}>;
export declare const onRegister: (func: any) => any;
//# sourceMappingURL=index.d.ts.map