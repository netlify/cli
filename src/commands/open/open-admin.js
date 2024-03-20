import openBrowser from '../../utils/open-browser.js';
import { NetlifyLog, outro } from '../../utils/styles/index.js';
export const openAdmin = async (options, command) => {
    const { siteInfo } = command.netlify;
    await command.authenticate();
    NetlifyLog.info(`Opening "${siteInfo.name}" site admin UI:`);
    NetlifyLog.info(`> ${siteInfo.admin_url}`);
    await openBrowser({ url: siteInfo.admin_url });
    outro({ exit: true });
};
