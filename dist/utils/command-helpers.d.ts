import type { NetlifyAPI } from '@netlify/api';
import chokidar from 'chokidar';
import type { TokenLocation } from './types.js';
import type { CachedConfig } from '../lib/build.js';
export declare const chalk: import("chalk").ChalkInstance;
/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
export declare const padLeft: (str: any, count: any, filler?: string) => any;
export declare const version: string;
export declare const USER_AGENT: string;
export declare const NETLIFY_CYAN: import("chalk").ChalkInstance;
export declare const NETLIFY_CYAN_HEX = "#28b5ac";
export declare const NETLIFYDEVLOG: string;
export declare const NETLIFYDEVWARN: string;
export declare const NETLIFYDEVERR: string;
export declare const BANG: string;
/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @param {import('commander').Option} optionA
 * @param {import('commander').Option} optionB
 * @returns {number}
 * @example
 * options.sort(sortOptions)
 */
export declare const sortOptions: (optionA: any, optionB: any) => any;
export declare const pollForToken: ({ api, ticket, }: {
    api: NetlifyAPI;
    ticket: {
        id?: string;
        client_id?: string;
        authorized?: boolean;
        created_at?: string;
    };
}) => Promise<string>;
/**
 * Get a netlify token
 * @param {string} [tokenFromOptions] optional token from the provided --auth options
 * @returns {Promise<[null|string, 'flag' | 'env' |'config' |'not found']>}
 */
export type TokenTuple = [string | null, TokenLocation];
export declare const getToken: (tokenFromOptions?: string) => Promise<TokenTuple>;
/**
 * logs a json message
 */
export declare const logJson: (message?: unknown) => void;
export declare const log: (message?: string, ...args: string[]) => void;
export declare const logPadded: (message?: string, ...args: string[]) => void;
/**
 * logs a warning message
 */
export declare const warn: (message?: string) => void;
export declare const logAndThrowError: (message: unknown) => never;
export declare const logError: (message: unknown) => void;
export declare const exit: (code?: number) => never;
/**
 * When `build.publish` is not set by the user, the CLI behavior differs in
 * several ways. It detects it by checking if `build.publish` is `undefined`.
 * However, `@netlify/config` adds a default value to `build.publish`.
 * This removes 'publish' and 'publishOrigin' in this case.
 * TODO(serhalp): Come up with a better name (or kill it?). This sucks but it's descriptive.
 */
export type NormalizedCachedConfigConfig = CachedConfig['config'] | (Omit<CachedConfig['config'], 'build'> & {
    build: Omit<CachedConfig['config']['build'], 'publish' | 'publishOrigin'>;
});
export declare const normalizeConfig: (config: CachedConfig["config"]) => NormalizedCachedConfigConfig;
interface WatchDebouncedOptions {
    depth?: number;
    ignored?: (string | RegExp)[];
    onAdd?: (paths: string[]) => void;
    onChange?: (paths: string[]) => void;
    onUnlink?: (paths: string[]) => void;
}
/**
 * Adds a file watcher to a path or set of paths and debounces the events.
 */
export declare const watchDebounced: (target: string | string[], { depth, ignored, onAdd, onChange, onUnlink }: WatchDebouncedOptions) => Promise<chokidar.FSWatcher>;
export declare const getTerminalLink: (text: string, url: string) => string;
export declare const isNodeError: (err: unknown) => err is NodeJS.ErrnoException;
export declare const nonNullable: <T>(value: T) => value is NonNullable<T>;
export declare const noOp: () => void;
export interface APIError extends Error {
    status: number;
    message: string;
}
export declare class GitHubAPIError extends Error {
    status: string;
    constructor(status: string, message: string);
}
export interface GitHubRepoResponse {
    status?: string;
    message?: string;
    id?: number;
    name?: string;
    clone_url?: string;
    full_name?: string;
    private?: boolean;
    default_branch?: string;
    errors?: string[];
    is_template?: boolean;
}
export declare const checkFileForLine: (filename: string, line: string) => boolean;
export declare const TABTAB_CONFIG_LINE = "[[ -f ~/.config/tabtab/__tabtab.zsh ]] && . ~/.config/tabtab/__tabtab.zsh || true";
export declare const AUTOLOAD_COMPINIT = "autoload -U compinit; compinit";
export declare const netlifyCommand: () => "netlify" | "npx netlify" | "pnpm exec netlify" | "pnpx netlify";
export {};
//# sourceMappingURL=command-helpers.d.ts.map