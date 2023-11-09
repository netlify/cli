import process from 'process';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'bett... Remove this comment to see the full error message
import open from 'better-opn';
import isDockerContainer from 'is-docker';
import { chalk, log } from './command-helpers.mjs';
// @ts-expect-error TS(7031) FIXME: Binding element 'message' implicitly has an 'any' ... Remove this comment to see the full error message
const unableToOpenBrowserMessage = function ({ message, url }) {
    log('---------------------------');
    log(chalk.redBright(`Error: Unable to open browser automatically: ${message}`));
    log(chalk.cyan('Please open your browser and open the URL below:'));
    log(chalk.bold(url));
    log('---------------------------');
};
/**
 * Opens a browser and logs a message if it is not possible
 * @param {object} config
 * @param {string} config.url The url to open
 * @param {boolean} [config.silentBrowserNoneError]
 * @returns {Promise<void>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'silentBrowserNoneError' implicitl... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        unableToOpenBrowserMessage({ url, message: error.message });
    }
};
export default openBrowser;
