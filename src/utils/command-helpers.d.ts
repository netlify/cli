/// <reference types="node" resolution-mode="require"/>
import chokidar from 'chokidar';
export declare const chalk: import("chalk").ChalkInstance;
/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
export declare const padLeft: (str: any, count: any, filler?: string) => any;
export declare const version: any;
export declare const USER_AGENT: string;
export declare const NETLIFY_CYAN: import("chalk").ChalkInstance;
export declare const NETLIFYDEV: string;
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
/**
 *
 * @param {object} config
 * @param {import('netlify').NetlifyAPI} config.api
 * @param {object} config.ticket
 * @returns
 */
export declare const pollForToken: ({ api, ticket }: {
    api: any;
    ticket: any;
}) => Promise<any>;
export declare const getToken: (tokenFromOptions?: string) => Promise<any[]>;
export declare const isDefaultJson: () => boolean;
/**
 * logs a json message
 */
export declare const logJson: (message?: unknown) => void;
export declare const log: (message?: string, ...args: any[]) => void;
export declare const logPadded: (message?: string, ...args: any[]) => void;
/**
 * logs a warning message
 * @param {string} message
 */
export declare const warn: (message?: string) => void;
/** Throws an error or logs it */
export declare const error: (message?: Error | string, options?: {
    exit?: boolean;
}) => void;
export declare const exit: (code?: number) => never;
/**
 * When `build.publish` is not set by the user, the CLI behavior differs in
 * several ways. It detects it by checking if `build.publish` is `undefined`.
 * However, `@netlify/config` adds a default value to `build.publish`.
 * This removes 'publish' and 'publishOrigin' in this case.
 * @param {*} config
 */
export declare const normalizeConfig: (config: any) => any;
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
export declare const getTerminalLink: (text: any, url: any) => string;
export declare const isNodeError: (err: unknown) => err is NodeJS.ErrnoException;
export declare const nonNullable: <T>(value: T) => value is NonNullable<T>;
export declare const noOp: () => void;
export {};
//# sourceMappingURL=command-helpers.d.ts.map