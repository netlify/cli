import type { InvocationError } from './netlify-function.js';
export declare const warnIfAwsSdkError: ({ error }: {
    error: Error | InvocationError | string;
}) => void;
export declare const formatLambdaError: (err: Error | InvocationError) => string;
export declare const shouldBase64Encode: (contentType?: string) => boolean;
export declare const styleFunctionName: (name: string) => string;
//# sourceMappingURL=utils.d.ts.map