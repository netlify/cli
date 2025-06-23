import prettyjson from 'prettyjson';
import { log } from '../../utils/command-helpers.js';
export const statusHooks = async (_options, command) => {
    const { api, siteInfo } = command.netlify;
    await command.authenticate();
    const ntlHooks = await api.listHooksBySiteId({ siteId: siteInfo.id });
    const data = {
        project: siteInfo.name,
        hooks: {},
    };
    ntlHooks.forEach((hook) => {
        // TODO(serhalp): Surely the `listHooksBySiteId` type is wrong about `id` being optional. Fix.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const id = hook.id;
        data.hooks[id] = {
            type: hook.type,
            event: hook.event,
            id,
            disabled: hook.disabled ?? false,
        };
        if (siteInfo.build_settings?.repo_url) {
            data.hooks[id].repo_url = siteInfo.build_settings.repo_url;
        }
    });
    log(`─────────────────┐
Project Hook Status │
─────────────────┘`);
    log(prettyjson.render(data));
};
//# sourceMappingURL=status-hooks.js.map