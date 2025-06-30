import { exit, log } from '../../utils/command-helpers.js';
import openBrowser from '../../utils/open-browser.js';
export const openSite = async (_options, command) => {
    const { siteInfo } = command.netlify;
    await command.authenticate();
    const url = siteInfo.ssl_url || siteInfo.url;
    log(`Opening "${siteInfo.name}" project url:`);
    log(`> ${url}`);
    await openBrowser({ url });
    exit();
};
//# sourceMappingURL=open-site.js.map