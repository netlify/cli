import { exit, log } from '../../utils/command-helpers.js';
import openBrowser from '../../utils/open-browser.js';
export const openAdmin = async (_options, command) => {
    const { siteInfo } = command.netlify;
    await command.authenticate();
    log(`Opening "${siteInfo.name}" project admin UI:`);
    log(`> ${siteInfo.admin_url}`);
    await openBrowser({ url: siteInfo.admin_url });
    exit();
};
//# sourceMappingURL=open-admin.js.map