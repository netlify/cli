import { log } from '../../utils/command-helpers.mjs';
import { createOpenAdminCommand, openAdmin } from './open-admin.mjs';
import { createOpenSiteCommand, openSite } from './open-site.mjs';
/**
 * The open command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const open = async (options, command) => {
    if (!options.site || !options.admin) {
        log(command.helpInformation());
    }
    if (options.site) {
        await openSite(options, command);
    }
    // Default open netlify admin
    await openAdmin(options, command);
};
/**
 * Creates the `netlify open` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createOpenCommand = (program) => {
    createOpenAdminCommand(program);
    createOpenSiteCommand(program);
    return program
        .command('open')
        .description(`Open settings for the site linked to the current folder`)
        .option('--site', 'Open site')
        .option('--admin', 'Open Netlify site')
        .addExamples(['netlify open --site', 'netlify open --admin', 'netlify open:admin', 'netlify open:site'])
        .action(open);
};
