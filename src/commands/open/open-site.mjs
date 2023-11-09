import { exit, log } from '../../utils/command-helpers.mjs';
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs';
import openBrowser from '../../utils/open-browser.mjs';
/**
 * The open:site command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
export const openSite = async (options, command) => {
    const { siteInfo } = command.netlify;
    await command.authenticate();
    const url = siteInfo.ssl_url || siteInfo.url;
    log(`Opening "${siteInfo.name}" site url:`);
    log(`> ${url}`);
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ url: any; }' is not assignable... Remove this comment to see the full error message
    await openBrowser({ url });
    exit();
};
/**
 * Creates the `netlify open:site` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createOpenSiteCommand = (program) => program
    .command('open:site')
    .description('Opens current site url in browser')
    .addExamples(['netlify open:site'])
    .hook('preAction', requiresSiteInfo)
    .action(openSite);
