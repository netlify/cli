export declare const detectNetlifyLambda: ({ packageJson }?: {
    packageJson: any;
}) => Promise<false | {
    build: ({ cache }?: {
        cache?: {} | undefined;
    }) => Promise<{
        srcFiles: string[];
    }>;
    builderName: string;
    npmScript: string;
}>;
export default function handler(): Promise<false | {
    build: ({ cache }?: {
        cache?: {} | undefined;
    }) => Promise<{
        srcFiles: string[];
    }>;
    builderName: string;
    npmScript: string;
}>;
//# sourceMappingURL=netlify-lambda.d.ts.map