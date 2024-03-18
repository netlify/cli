import type { OptionValues } from 'commander';
import BaseCommand from '../commands/base-command.js';
import { type DevConfig } from '../commands/dev/types.js';
import { ServerSettings } from './types.js';
/**
 * Get the server settings based on the flags and the devConfig
 */
declare const detectServerSettings: (devConfig: DevConfig, flags: OptionValues, command: BaseCommand) => Promise<ServerSettings>;
/**
 * Returns a copy of the provided config with any plugins provided by the
 * server settings
 */
export declare const getConfigWithPlugins: (config: any, settings: ServerSettings) => any;
export default detectServerSettings;
//# sourceMappingURL=detect-server-settings.d.ts.map