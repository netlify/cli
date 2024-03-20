export declare const getTemplatesFromGitHub: (token: any) => Promise<any>;
export declare const validateTemplate: ({ ghToken, templateName }: {
    ghToken: any;
    templateName: any;
}) => Promise<{
    exists: boolean;
    isTemplate?: undefined;
} | {
    exists: boolean;
    isTemplate: any;
}>;
export declare const createRepo: (templateName: string, ghToken: string, siteName: string) => Promise<any>;
//# sourceMappingURL=utils.d.ts.map