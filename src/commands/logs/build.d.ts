import type { OptionValues } from 'commander';
import type BaseCommand from '../base-command.js';
type Deploy = {
    id: string;
    user_id?: string;
    context?: string;
    review_id: string;
};
export declare function getName({ deploy, userId }: {
    deploy: Deploy;
    userId: string;
}): string;
export declare const logsBuild: (options: OptionValues, command: BaseCommand) => Promise<void>;
export {};
//# sourceMappingURL=build.d.ts.map