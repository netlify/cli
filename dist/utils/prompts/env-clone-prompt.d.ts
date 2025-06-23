import { EnvVar } from '../types.js';
export declare const generateEnvVarsList: (envVarsToDelete: EnvVar[]) => string[];
/**
 * Prompts the user to confirm overwriting environment variables on a project.
 *
 * @param {string} siteId - The ID of the project.
 * @param {EnvVar[]} existingEnvVars - The environment variables that already exist on the project.
 * @returns {Promise<void>} A promise that resolves when the user has confirmed the overwriting of the variables.
 */
export declare function promptEnvCloneOverwrite(siteId: string, existingEnvVars: EnvVar[]): Promise<void>;
//# sourceMappingURL=env-clone-prompt.d.ts.map