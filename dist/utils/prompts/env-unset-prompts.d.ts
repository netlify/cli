/**
 * Logs a warning and prompts user to confirm overwriting an existing environment variable
 *
 * @param {string} key - The key of the environment variable that already exists
 * @returns {Promise<void>} A promise that resolves when the user has confirmed overwriting the variable
 */
export declare const promptOverwriteEnvVariable: (existingKey: string) => Promise<void>;
//# sourceMappingURL=env-unset-prompts.d.ts.map