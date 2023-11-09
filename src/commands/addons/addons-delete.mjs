import inquirer from 'inquirer';
import { ADDON_VALIDATION, prepareAddonCommand } from '../../utils/addons/prepare.mjs';
import { error, exit, log } from '../../utils/command-helpers.mjs';
/**
 * The addons:delete command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
const addonsDelete = async (addonName, options, command) => {
    const { addon } = await prepareAddonCommand({
        command,
        addonName,
        validation: ADDON_VALIDATION.EXISTS,
    });
    if (!options.force && !options.f) {
        const { wantsToDelete } = await inquirer.prompt({
            type: 'confirm',
            name: 'wantsToDelete',
            message: `Are you sure you want to delete the ${addonName} add-on? (to skip this prompt, pass a --force flag)`,
            default: false,
        });
        if (!wantsToDelete) {
            exit();
        }
    }
    try {
        await command.netlify.api.deleteServiceInstance({
            siteId: command.netlify.site.id,
            addon: addonName,
            instanceId: addon.id,
        });
        log(`Addon "${addonName}" deleted`);
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        error(error_.message);
    }
};
/**
 * Creates the `netlify addons:delete` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createAddonsDeleteCommand = (program) => program
    .command('addons:delete', { hidden: true })
    .alias('addon:delete')
    .argument('<name>', 'Add-on namespace')
    .description(`Remove an add-on extension to your site\nAdd-ons are a way to extend the functionality of your Netlify site`)
    .option('-f, --force', 'delete without prompting (useful for CI)')
    .action(addonsDelete);
