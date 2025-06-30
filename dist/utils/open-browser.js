import process from 'process';
import open from 'open';
import isDockerContainer from 'is-docker';
import { chalk, log } from './command-helpers.js';
const unableToOpenBrowserMessage = function ({ message, url }) {
    log('---------------------------');
    log(chalk.redBright(`Error: Unable to open browser automatically: ${message}`));
    log(chalk.cyan('Please open your browser and open the URL below:'));
    log(chalk.bold(url));
    log('---------------------------');
};
const openBrowser = async function ({ silentBrowserNoneError, url }) {
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
        if (error instanceof Error) {
            unableToOpenBrowserMessage({ url, message: error.message });
        }
    }
};
export default openBrowser;
//# sourceMappingURL=open-browser.js.map