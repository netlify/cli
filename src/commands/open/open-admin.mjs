import { exit, log } from '../../utils/command-helpers.mjs';
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs';
import openBrowser from '../../utils/open-browser.mjs';
/**
 * The open:admin command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
export const openAdmin = async (options, command) => {
    const { siteInfo } = command.netlify;
    await command.authenticate();
    log(`Opening "${siteInfo.name}" site admin UI:`);
    log(`> ${siteInfo.admin_url}`);
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
    await openBrowser({ url: siteInfo.admin_url });
    exit();
};
/**
 * Creates the `netlify open:admin` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createOpenAdminCommand = (program) => program
    .command('open:admin')
    .description('Opens current site admin UI in Netlify')
    .addExamples(['netlify open:admin'])
    .hook('preAction', requiresSiteInfo)
    .action(openAdmin);
