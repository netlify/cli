import prettyjson from 'prettyjson';
import { log } from '../../utils/command-helpers.mjs';
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs';
/**
 * The status:hooks command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const statusHooks = async (options, command) => {
    const { api, siteInfo } = command.netlify;
    await command.authenticate();
    const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id });
    const data = {
        site: siteInfo.name,
        hooks: {},
    };
    // @ts-expect-error TS(7006) FIXME: Parameter 'hook' implicitly has an 'any' type.
    ntlHooks.forEach((hook) => {
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data.hooks[hook.id] = {
            type: hook.type,
            event: hook.event,
            id: hook.id,
            disabled: hook.disabled,
        };
        if (siteInfo.build_settings?.repo_url) {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            data.hooks[hook.id].repo_url = siteInfo.build_settings.repo_url;
        }
    });
    log(`─────────────────┐
Site Hook Status │
─────────────────┘`);
    log(prettyjson.render(data));
};
/**
 * Creates the `netlify status:hooks` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createStatusHooksCommand = (program) => program
    .command('status:hooks')
    .description('Print hook information of the linked site')
    .hook('preAction', requiresSiteInfo)
    .action(statusHooks);
