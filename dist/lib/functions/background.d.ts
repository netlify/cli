import express from 'express';
import type { InvocationError } from './netlify-function.js';
export declare const handleBackgroundFunction: (functionName: string, response: express.Response) => void;
export declare const handleBackgroundFunctionResult: (functionName: string, err: null | Error | InvocationError) => void;
//# sourceMappingURL=background.d.ts.map