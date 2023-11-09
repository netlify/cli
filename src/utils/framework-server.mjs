import waitPort from 'wait-port';
import { startSpinner, stopSpinner } from '../lib/spinner.mjs';
import { error, exit, log, NETLIFYDEVERR, NETLIFYDEVLOG } from './command-helpers.mjs';
import { runCommand } from './shell.mjs';
import { startStaticServer } from './static-server.mjs';
// 10 minutes
const FRAMEWORK_PORT_TIMEOUT = 6e5;
/**
 * @typedef StartReturnObject
 * @property {4 | 6 | undefined=} ipVersion The version the open port was found on
 */
/**
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 * @param {object} config
 * @param {import('./types.js').ServerSettings} config.settings
 * @param {string} config.cwd
 * @returns {Promise<StartReturnObject>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'cwd' implicitly has an 'any' type... Remove this comment to see the full error message
export const startFrameworkServer = async function ({ cwd, settings }) {
    if (settings.useStaticServer) {
        if (settings.command) {
            runCommand(settings.command, { env: settings.env, cwd });
        }
        await startStaticServer({ settings });
        return {};
    }
    log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`);
    const spinner = startSpinner({
        text: `Waiting for framework port ${settings.frameworkPort}. This can be configured using the 'targetPort' property in the netlify.toml`,
    });
    runCommand(settings.command, { env: settings.env, spinner, cwd });
    let port;
    try {
        port = await waitPort({
            port: settings.frameworkPort,
            host: 'localhost',
            output: 'silent',
            timeout: FRAMEWORK_PORT_TIMEOUT,
            ...(settings.pollingStrategies?.includes('HTTP') && { protocol: 'http' }),
        });
        if (!port.open) {
            throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`);
        }
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ error: boolean; spinner: Ora; ... Remove this comment to see the full error message
        stopSpinner({ error: false, spinner });
    }
    catch (error_) {
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ error: boolean; spinner: Ora; ... Remove this comment to see the full error message
        stopSpinner({ error: true, spinner });
        log(NETLIFYDEVERR, `Netlify Dev could not start or connect to localhost:${settings.frameworkPort}.`);
        log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`);
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        error(error_);
        exit(1);
    }
    return { ipVersion: port?.ipVersion };
};
