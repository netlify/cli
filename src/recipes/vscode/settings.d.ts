import * as JSONC from 'comment-json';
export declare const applySettings: (existingSettings: any, { denoBinary, edgeFunctionsPath, repositoryRoot }: {
    denoBinary: any;
    edgeFunctionsPath: any;
    repositoryRoot: any;
}) => any;
export declare const getSettings: (settingsPath: any) => Promise<{
    fileExists: boolean;
    settings: JSONC.CommentJSONValue;
} | {
    fileExists: boolean;
    settings: {};
}>;
export declare const writeSettings: ({ settings, settingsPath }: {
    settings: any;
    settingsPath: any;
}) => Promise<void>;
//# sourceMappingURL=settings.d.ts.map