import BaseCommand from '../base-command.js';
export type DatabaseInitOptions = {
    assumeNo: boolean;
    boilerplate: DatabaseBoilerplateType | false;
    overwrite: boolean;
};
export type DatabaseBoilerplateType = 'drizzle';
export declare const init: (options: DatabaseInitOptions, command: BaseCommand) => Promise<void>;
//# sourceMappingURL=init.d.ts.map