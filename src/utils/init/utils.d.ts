import BaseCommand from '../../commands/base-command.js';
import { $TSFixMe } from '../../commands/types.js';
/**
 * Retrieve a list of plugins to auto install
 * @param pluginsToAlwaysInstall these plugins represent runtimes that are
 * expected to be "automatically" installed. Even though
 * they can be installed on package/toml, we always
 * want them installed in the site settings. When installed
 * there our build will automatically install the latest without
 * user management of the versioning.
 * @param pluginsInstalled
 * @param pluginsRecommended
 * @returns
 */
export declare const getPluginsToAutoInstall: (command: BaseCommand, pluginsInstalled?: string[], pluginsRecommended?: string[]) => string[];
export declare const getBuildSettings: ({ command, config }: {
    command: BaseCommand;
    config: $TSFixMe;
}) => Promise<{
    baseDir: any;
    buildCmd: any;
    buildDir: any;
    functionsDir: any;
    pluginsToInstall: any;
}>;
export declare const saveNetlifyToml: ({ baseDir, buildCmd, buildDir, config, configPath, functionsDir, repositoryRoot, }: {
    baseDir: any;
    buildCmd: any;
    buildDir: any;
    config: any;
    configPath: any;
    functionsDir: any;
    repositoryRoot: any;
}) => Promise<void>;
export declare const formatErrorMessage: ({ error, message }: {
    error: any;
    message: any;
}) => string;
export declare const createDeployKey: ({ api }: {
    api: any;
}) => Promise<any>;
export declare const updateSite: ({ api, options, siteId }: {
    api: any;
    options: any;
    siteId: any;
}) => Promise<any>;
export declare const setupSite: ({ api, configPlugins, pluginsToInstall, repo, siteId }: {
    api: any;
    configPlugins: any;
    pluginsToInstall: any;
    repo: any;
    siteId: any;
}) => Promise<any>;
//# sourceMappingURL=utils.d.ts.map