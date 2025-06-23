import type { RunRecipeOptions } from '../../commands/recipes/recipes.js';
import { ConsumerConfig } from './context.js';
export declare const description = "Manage context files for AI tools";
/**
 * Checks if a command belongs to a known IDEs by checking if it includes a specific string.
 * For example, the command that starts windsurf looks something like "/applications/windsurf.app/contents/...".
 */
export declare const getConsumerKeyFromCommand: (command: string) => string | null;
/**
 * Receives a process ID (pid) and returns both the command that the process was run with and its parent process ID. If the process is a known IDE, also returns information about that IDE.
 */
export declare const getCommandAndParentPID: (pid: number) => Promise<{
    parentPID: number;
    command: string;
    consumerKey: string | null;
}>;
/**
 * Detects the IDE by walking up the process tree and matching against known consumer processes
 */
export declare const detectIDE: () => Promise<ConsumerConfig | null>;
export declare const run: (runOptions: RunRecipeOptions) => Promise<void>;
//# sourceMappingURL=index.d.ts.map