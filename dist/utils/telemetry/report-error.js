import os from 'os';
import { dirname, join } from 'path';
import process, { version as nodejsVersion } from 'process';
import { fileURLToPath } from 'url';
import { isCI } from 'ci-info';
import execa from '../execa.js';
import getGlobalConfigStore from '../get-global-config-store.js';
import { cliVersion } from './utils.js';
const dirPath = dirname(fileURLToPath(import.meta.url));
/**
 *
 * @param {import('@bugsnag/js').NotifiableError} error
 * @param {object} config
 * @param {import('@bugsnag/js').Event['severity']} config.severity
 * @param {Record<string, Record<string, any>>} [config.metadata]
 * @returns {Promise<void>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'error' implicitly has an 'any' type.
export const reportError = async function (error, config = {}) {
    if (isCI) {
        return;
    }
    // convert a NotifiableError to an error class
    const err = error instanceof Error ? error : typeof error === 'string' ? new Error(error) : error;
    const globalConfig = await getGlobalConfigStore();
    const options = JSON.stringify({
        type: 'error',
        data: {
            message: err.message,
            name: err.name,
            stack: err.stack,
            cause: err.cause,
            // @ts-expect-error TS(2339) FIXME: Property 'severity' does not exist on type '{}'.
            severity: config.severity,
            user: {
                id: globalConfig.get('userId'),
            },
            // @ts-expect-error TS(2339) FIXME: Property 'metadata' does not exist on type '{}'.
            metadata: config.metadata,
            osName: `${os.platform()}-${os.arch()}`,
            cliVersion,
            nodejsVersion,
        },
    });
    // spawn detached child process to handle send and wait for the http request to finish
    // otherwise it can get canceled
    await execa(process.execPath, [join(dirPath, 'request.js'), options], {
        detached: true,
        stdio: 'ignore',
    });
};
//# sourceMappingURL=report-error.js.map