import { NetlifyLog, intro } from '../../utils/styles/index.js';
import { openAdmin } from './open-admin.js';
import { openSite } from './open-site.js';
export const open = async (options, command) => {
    intro('open');
    if (!options.site || !options.admin) {
        NetlifyLog.info(command.helpInformation());
    }
    if (options.site) {
        await openSite(options, command);
    }
    // Default open netlify admin
    await openAdmin(options, command);
};
