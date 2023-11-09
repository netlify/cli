import { ADDON_VALIDATION, prepareAddonCommand } from '../../utils/addons/prepare.mjs';
import { exit, log } from '../../utils/command-helpers.mjs';
import openBrowser from '../../utils/open-browser.mjs';
/**
 * The addons:auth command
 * @param {string} addonName
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
const addonsAuth = async (addonName, options, command) => {
    const { addon } = await prepareAddonCommand({
        command,
        addonName,
        validation: ADDON_VALIDATION.EXISTS,
    });
    if (!addon.auth_url) {
        log(`No Admin URL found for the "${addonName} add-on"`);
        return false;
    }
    log();
    log(`Opening ${addonName} add-on admin URL:`);
    log();
    log(addon.auth_url);
    log();
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
    await openBrowser({ url: addon.auth_url });
    exit();
};
/**
 * Creates the `netlify addons:auth` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createAddonsAuthCommand = (program) => program
    .command('addons:auth', { hidden: true })
    .alias('addon:auth')
    .argument('<name>', 'Add-on slug')
    .description('Login to add-on provider')
    // @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
    .action(async (addonName, options, command) => {
    await addonsAuth(addonName, options, command);
});
