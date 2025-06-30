import type { RunRecipeOptions } from '../../commands/recipes/recipes.js';
export declare const NTL_DEV_MCP_FILE_NAME = "netlify-development.mdc";
export declare const NETLIFY_PROVIDER = "netlify";
export interface ContextConfig {
    scope: string;
    glob?: string;
    shared?: string[];
    endpoint?: string;
}
export interface ContextFile {
    key: string;
    config: ContextConfig;
    content: string;
}
export interface ConsumerConfig {
    key: string;
    presentedName: string;
    consumerProcessCmd?: string;
    path: string;
    ext: string;
    truncationLimit?: number;
    contextScopes: Record<string, ContextConfig>;
    hideFromCLI?: boolean;
    consumerTrigger?: string;
}
export declare const getContextConsumers: (cliVersion: string) => Promise<ConsumerConfig[]>;
export declare const downloadFile: (cliVersion: string, contextConfig: ContextConfig, consumer: ConsumerConfig) => Promise<{
    contents: string;
    minimumCLIVersion: string | undefined;
} | null>;
interface ParsedContextFile {
    contents: string;
    innerContents?: string;
    overrides?: {
        contents?: string;
        innerContents?: string;
    };
    provider?: string;
    version?: string;
}
/**
 * Parses the `<ProviderContext>` and `<ProviderContextOverrides>` blocks in
 * a context file.
 */
export declare const parseContextFile: (contents: string) => ParsedContextFile;
/**
 * Takes a context file (a template) and injects a string in an overrides block
 * if one is found. Returns the resulting context file.
 */
export declare const applyOverrides: (template: string, overrides?: string) => string;
/**
 * Reads a file on disk and tries to parse it as a context file.
 */
export declare const getExistingContext: (path: string) => Promise<ParsedContextFile | null>;
export declare const writeFile: (path: string, contents: string) => Promise<void>;
export declare const deleteFile: (path: string) => Promise<void>;
export declare const downloadAndWriteContextFiles: (consumer: ConsumerConfig, { command }: RunRecipeOptions) => Promise<void>;
export {};
//# sourceMappingURL=context.d.ts.map