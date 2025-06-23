import type { IncomingHttpHeaders } from 'node:http';
import express from 'express';
import type { LambdaEvent } from 'lambda-local';
import type { InvocationError } from './netlify-function.js';
export declare const buildHelpResponse: ({ error, headers, path, result, }: {
    error: null | Error | InvocationError;
    headers: IncomingHttpHeaders;
    path: string;
    result: null | LambdaEvent;
}) => {
    contentType: string;
    message: string;
    statusCode: number;
};
export declare const handleScheduledFunction: ({ error, request, response, result, }: {
    error: null | Error | InvocationError;
    request: express.Request;
    response: express.Response;
    result: null | LambdaEvent;
}) => void;
//# sourceMappingURL=scheduled.d.ts.map