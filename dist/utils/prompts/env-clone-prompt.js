import { log } from '../command-helpers.js';
import { confirmPrompt } from './confirm-prompt.js';
import { destructiveCommandMessages } from './prompt-messages.js';
export const generateEnvVarsList = (envVarsToDelete) => envVarsToDelete.map((envVar) => envVar.key);
/**
 * Prompts the user to confirm overwriting environment variables on a project.
 *
 * @param {string} siteId - The ID of the project.
 * @param {EnvVar[]} existingEnvVars - The environment variables that already exist on the project.
 * @returns {Promise<void>} A promise that resolves when the user has confirmed the overwriting of the variables.
 */
export async function promptEnvCloneOverwrite(siteId, existingEnvVars) {
    const { generateWarning } = destructiveCommandMessages.envClone;
    const existingEnvVarKeys = generateEnvVarsList(existingEnvVars);
    const warningMessage = generateWarning(siteId);
    log();
    log(warningMessage);
    log();
    log(destructiveCommandMessages.envClone.noticeEnvVars);
    log();
    existingEnvVarKeys.forEach((envVar) => {
        log(envVar);
    });
    log();
    log(destructiveCommandMessages.overwriteNotice);
    await confirmPrompt(destructiveCommandMessages.envClone.overwriteConfirmation);
}
//# sourceMappingURL=env-clone-prompt.js.map