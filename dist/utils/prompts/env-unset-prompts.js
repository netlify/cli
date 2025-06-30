import { log } from '../command-helpers.js';
import { confirmPrompt } from './confirm-prompt.js';
import { destructiveCommandMessages } from './prompt-messages.js';
/**
 * Logs a warning and prompts user to confirm overwriting an existing environment variable
 *
 * @param {string} key - The key of the environment variable that already exists
 * @returns {Promise<void>} A promise that resolves when the user has confirmed overwriting the variable
 */
export const promptOverwriteEnvVariable = async (existingKey) => {
    const { generateWarning } = destructiveCommandMessages.envUnset;
    const warningMessage = generateWarning(existingKey);
    log(warningMessage);
    log();
    log(destructiveCommandMessages.overwriteNotice);
    await confirmPrompt(destructiveCommandMessages.envUnset.overwriteConfirmation);
};
//# sourceMappingURL=env-unset-prompts.js.map