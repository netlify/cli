import type { RequestHandler } from 'express';
import type { FunctionsRegistry } from './registry.js';
export declare const getFormHandler: ({ functionsRegistry, logWarning, }: {
    functionsRegistry: FunctionsRegistry;
    logWarning?: boolean;
}) => string | undefined;
export declare const createFormSubmissionHandler: ({ functionsRegistry, siteUrl, }: {
    functionsRegistry: FunctionsRegistry;
    siteUrl: string;
}) => RequestHandler;
//# sourceMappingURL=form-submissions-handler.d.ts.map