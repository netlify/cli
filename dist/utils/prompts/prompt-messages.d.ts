export declare const destructiveCommandMessages: {
    overwriteNotice: string;
    blobSet: {
        generateWarning: (key: string, storeName: string) => string;
        overwriteConfirmation: string;
    };
    blobDelete: {
        generateWarning: (key: string, storeName: string) => string;
        overwriteConfirmation: string;
    };
    envSet: {
        generateWarning: (variableName: string) => string;
        overwriteConfirmation: string;
    };
    envUnset: {
        generateWarning: (variableName: string) => string;
        overwriteConfirmation: string;
    };
    envClone: {
        generateWarning: (siteId: string) => string;
        noticeEnvVars: string;
        overwriteConfirmation: string;
    };
};
//# sourceMappingURL=prompt-messages.d.ts.map