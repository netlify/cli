import process from 'process';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'bett... Remove this comment to see the full error message
import open from 'better-opn';
import isDockerContainer from 'is-docker';
import { chalk } from './command-helpers.js';
import { NetlifyLog } from './styles/index.js';
const unableToOpenBrowserMessage = function ({ message, url }) {
    NetlifyLog.error(chalk.redBright(`Error: Unable to open browser automatically: ${message}`), { exit: false });
    NetlifyLog.message(chalk.cyan('Please open your browser and open the URL below:'));
    NetlifyLog.message(chalk.bold(url));
};
const openBrowser = async function ({ silentBrowserNoneError, url, }) {
    if (isDockerContainer()) {
        unableToOpenBrowserMessage({ url, message: 'Running inside a docker container' });
        return;
    }
    if (process.env.BROWSER === 'none') {
        if (!silentBrowserNoneError) {
            unableToOpenBrowserMessage({ url, message: "BROWSER environment variable is set to 'none'" });
        }
        return;
    }
    try {
        await open(url);
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        unableToOpenBrowserMessage({ url, message: error.message });
    }
};
export default openBrowser;
