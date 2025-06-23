import type { BaseOptionValues } from '../base-command.js';
export type DeployOptionValues = BaseOptionValues & {
    alias?: string;
    build: boolean;
    branch?: string;
    context?: string;
    dir?: string;
    functions?: string;
    json: boolean;
    message?: string;
    open: boolean;
    prod: boolean;
    prodIfUnlocked: boolean;
    site?: string;
    skipFunctionsCache: boolean;
    timeout?: number;
    trigger?: boolean;
};
//# sourceMappingURL=option_values.d.ts.map