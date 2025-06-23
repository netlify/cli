import inquirer from 'inquirer';
import { chalk, logAndThrowError, exit, log } from '../../utils/command-helpers.js';
export const sitesDelete = async (siteId, options, command) => {
    command.setAnalyticsPayload({ force: options.force });
    const { api, site } = command.netlify;
    const cwdSiteId = site.id;
    // 1. Prompt user for verification
    await command.authenticate(options.auth);
    let siteData;
    try {
        siteData = await api.getSite({ siteId });
    }
    catch (error_) {
        if (error_.status === 404) {
            return logAndThrowError(`No project with id ${siteId} found. Please verify the project ID & try again.`);
        }
        else {
            return logAndThrowError(error_);
        }
    }
    const noForce = options.force !== true;
    /* Verify the user wants to delete the project */
    if (noForce) {
        log(`${chalk.redBright('Warning')}: You are about to permanently delete "${chalk.bold(siteData.name)}"`);
        log(`         Verify this project ID "${siteId}" supplied is correct and proceed.`);
        log('         To skip this prompt, pass a --force flag to the delete command');
        log();
        log(chalk.bold('Be careful here. There is no undo!'));
        log();
        const { wantsToDelete } = await inquirer.prompt({
            type: 'confirm',
            name: 'wantsToDelete',
            message: `WARNING: Are you sure you want to delete the "${siteData.name}" project?`,
            default: false,
        });
        log();
        if (!wantsToDelete) {
            exit();
        }
    }
    /* Validation logic if siteId passed in does not match current project ID */
    if (noForce && cwdSiteId && cwdSiteId !== siteId) {
        log(`${chalk.redBright('Warning')}: The project ID supplied does not match the current working directory project ID`);
        log();
        log(`Supplied:       "${siteId}"`);
        log(`Current Project: "${cwdSiteId}"`);
        log();
        log(`Verify this project ID "${siteId}" supplied is correct and proceed.`);
        log('To skip this prompt, pass a --force flag to the delete command');
        const { wantsToDelete } = await inquirer.prompt({
            type: 'confirm',
            name: 'wantsToDelete',
            message: `Verify & Proceed with deletion of project "${siteId}"?`,
            default: false,
        });
        if (!wantsToDelete) {
            exit();
        }
    }
    log(`Deleting project "${siteId}"...`);
    try {
        await api.deleteSite({ site_id: siteId });
    }
    catch (error_) {
        if (error_.status === 404) {
            return logAndThrowError(`No project with id ${siteId} found. Please verify the project ID & try again.`);
        }
        else {
            return logAndThrowError(`Delete Project error: ${error_.status}: ${error_.message}`);
        }
    }
    log(`Project "${siteId}" successfully deleted!`);
};
//# sourceMappingURL=sites-delete.js.map