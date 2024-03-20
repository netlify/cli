export declare const tryGetAgent: ({ certificateFile, httpProxy }: {
    certificateFile: any;
    httpProxy: any;
}) => Promise<{
    error?: undefined;
    message?: undefined;
} | {
    error: string;
    message?: undefined;
} | {
    error: string;
    message: any;
}>;
export declare const getAgent: ({ certificateFile, httpProxy }: {
    certificateFile: any;
    httpProxy: any;
}) => Promise<any>;
//# sourceMappingURL=http-agent.d.ts.map