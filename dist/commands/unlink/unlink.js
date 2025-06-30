import { exit, log } from '../../utils/command-helpers.js';
import { track } from '../../utils/telemetry/index.js';
import { chalk, netlifyCommand } from '../../utils/command-helpers.js';
export const unlink = async (_options, command) => {
    const { site, siteInfo, state } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log(`Folder is not linked to a Netlify project. Run ${chalk.cyanBright(`${netlifyCommand()} link`)} to link it`);
        return exit();
    }
    const siteData = siteInfo;
    state.delete('siteId');
    await track('sites_unlinked', {
        siteId: siteData.id || siteId,
    });
    if (site && site.configPath) {
        log(`Unlinked ${site.configPath} from ${siteData ? siteData.name : siteId}`);
    }
    else {
        log(`Unlinked from ${siteData ? siteData.name : siteId}`);
    }
};
//# sourceMappingURL=unlink.js.map