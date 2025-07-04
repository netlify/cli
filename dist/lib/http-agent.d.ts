import { HttpsProxyAgent } from 'https-proxy-agent';
declare class HttpsProxyAgentWithCA extends HttpsProxyAgent {
    constructor(opts: any);
    callback(req: any, opts: any): any;
}
export declare const tryGetAgent: ({ certificateFile, httpProxy, }: {
    httpProxy?: string | undefined;
    certificateFile?: string | undefined;
}) => Promise<{
    error?: string | undefined;
    warning?: string | undefined;
    message?: string | undefined;
} | {
    agent: HttpsProxyAgentWithCA;
    response: unknown;
}>;
export declare const getAgent: ({ certificateFile, httpProxy }: {
    certificateFile: any;
    httpProxy: any;
}) => Promise<any>;
export {};
//# sourceMappingURL=http-agent.d.ts.map