import { Settings } from '@netlify/build-info';
import BaseCommand from '../commands/base-command.js';
/**
 * Detects and filters the build setting for a project and a command
 */
export declare function detectBuildSettings(command: BaseCommand): Promise<Settings[]>;
/**
 * Uses `@netlify/build-info` to detect the dev settings and port based on the framework
 * and the build system that is used.
 * @param command The base command
 * @param type The type of command (dev or build)
 */
export declare const detectFrameworkSettings: (command: BaseCommand, type?: 'dev' | 'build') => Promise<Settings | undefined>;
//# sourceMappingURL=build-info.d.ts.map