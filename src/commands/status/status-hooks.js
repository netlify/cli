import prettyjson from 'prettyjson';
import { logJson } from '../../utils/command-helpers.js';
import { NetlifyLog } from '../../utils/styles/index.js';
export const statusHooks = async (command) => {
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
    NetlifyLog.step('Site Hook Status');
    logJson(prettyjson.render(data));
};
