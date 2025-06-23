import { Project } from '@netlify/build-info';
import { Command, Help, type OptionValues } from 'commander';
import type { FeatureFlags } from '../utils/feature-flags.js';
import type { NetlifyOptions } from './types.js';
import type { CachedConfig } from '../lib/build.js';
type Analytics = {
    startTime: bigint;
    payload?: Record<string, unknown>;
};
export type BaseOptionValues = {
    auth?: string;
    cwd?: string;
    debug?: boolean;
    filter?: string;
    httpProxy?: string;
    silent?: string;
};
/** Base command class that provides tracking and config initialization */
export default class BaseCommand extends Command {
    #private;
    /** The netlify object inside each command with the state */
    netlify: NetlifyOptions;
    analytics: Analytics;
    project: Project;
    /**
     * The working directory that is used for reading the `netlify.toml` file and storing the state.
     * In a monorepo context this must not be the process working directory and can be an absolute path to the
     * Package/Site that should be worked in.
     */
    workingDir: string;
    /**
     * The workspace root if inside a mono repository.
     * Must not be the repository root!
     */
    jsWorkspaceRoot?: string;
    /** The current workspace package we should execute the commands in  */
    workspacePackage?: string;
    featureFlags: FeatureFlags;
    siteId?: string;
    accountId?: string;
    /**
     * IMPORTANT this function will be called for each command!
     * Don't do anything expensive in there.
     */
    createCommand(name: string): BaseCommand;
    /** don't show help options on command overview (mostly used on top commands like `addons` where options only apply on children) */
    noHelpOptions(): this;
    /** The examples list for the command (used inside doc generation and help page) */
    examples: string[];
    /** Set examples for the command  */
    addExamples(examples: string[]): this;
    /** Overrides the help output of commander with custom styling */
    createHelp(): Help;
    /** Will be called on the end of an action to track the metrics */
    onEnd(error_?: unknown): Promise<void>;
    authenticate(tokenFromFlag?: string): Promise<string>;
    expensivelyAuthenticate(): Promise<string>;
    /** Adds some data to the analytics payload */
    setAnalyticsPayload(payload: Record<string, unknown>): void;
    /**
     * Initializes the options and parses the configuration needs to be called on start of a command function
     */
    private init;
    /** Find and resolve the Netlify configuration */
    getConfig(opts: {
        cwd: string;
        token?: string | null;
        offline?: boolean;
        /** An optional path to the netlify configuration file e.g. netlify.toml */
        configFilePath?: string;
        packagePath?: string;
        repositoryRoot?: string;
        host?: string;
        pathPrefix?: string;
        scheme?: string;
    }): Promise<CachedConfig>;
    /**
     * get a path inside the `.netlify` project folder resolving with the workspace package
     */
    getPathInProject(...paths: string[]): string;
    /**
     * Returns the context that should be used in case one hasn't been explicitly
     * set. The default context is `dev` most of the time, but some commands may
     * wish to override that.
     */
    getDefaultContext(): 'production' | 'dev';
    /**
     * Retrieve feature flags for this site
     */
    getFeatureFlag<T extends null | boolean | string>(flagName: string): T;
}
export declare const getBaseOptionValues: (options: OptionValues) => BaseOptionValues;
export {};
//# sourceMappingURL=base-command.d.ts.map