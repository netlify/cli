import express from 'express';
import type { LambdaEvent } from 'lambda-local';
import type { InvocationError } from './netlify-function.js';
export declare const handleSynchronousFunction: ({ error: invocationError, functionName, request, response, result, }: {
    error: null | Error | InvocationError;
    functionName: string;
    request: express.Request;
    response: express.Response;
    result: null | LambdaEvent;
}) => Promise<void>;
//# sourceMappingURL=synchronous.d.ts.map