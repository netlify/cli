import BaseCommand from './base-command.js';
export declare const CI_FORCED_COMMANDS: {
    'env:set': {
        options: string;
        description: string;
    };
    'env:unset': {
        options: string;
        description: string;
    };
    'env:clone': {
        options: string;
        description: string;
    };
    'blobs:set': {
        options: string;
        description: string;
    };
    'blobs:delete': {
        options: string;
        description: string;
    };
    init: {
        options: string;
        description: string;
    };
    'sites:delete': {
        options: string;
        description: string;
    };
};
/**
 * Creates the `netlify-cli` command
 */
export declare const createMainCommand: () => BaseCommand;
//# sourceMappingURL=main.d.ts.map