import type { Settings } from '@netlify/build-info';
import type BaseCommand from '../commands/base-command.js';
import type { DefaultConfig } from '../lib/build.js';
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
export declare const detectFrameworkSettings: (command: BaseCommand, type?: "dev" | "build") => Promise<Settings | undefined>;
/**
 * Generates a defaultConfig for @netlify/build based on the settings from the heuristics
 * Returns the defaultConfig in the format that @netlify/build expects (json version of toml)
 * @param settings The settings from the heuristics
 */
export declare const getDefaultConfig: (settings?: Settings) => DefaultConfig | undefined;
//# sourceMappingURL=build-info.d.ts.map