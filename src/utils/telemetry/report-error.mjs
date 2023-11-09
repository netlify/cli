import os from 'os';
import { dirname, join } from 'path';
import process, { version as nodejsVersion } from 'process';
import { fileURLToPath } from 'url';
import { isCI } from 'ci-info';
// @ts-expect-error TS(7034) FIXME: Variable 'execa' implicitly has type 'any' in some... Remove this comment to see the full error message
import execa from '../execa.mjs';
import getGlobalConfig from '../get-global-config.mjs';
import { cliVersion } from './utils.mjs';
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
    // eslint-disable-next-line unicorn/no-nested-ternary
    const err = error instanceof Error ? error : typeof error === 'string' ? new Error(error) : error;
    const globalConfig = await getGlobalConfig();
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
    // @ts-expect-error TS(7005) FIXME: Variable 'execa' implicitly has an 'any' type.
    await execa(process.execPath, [join(dirPath, 'request.mjs'), options], {
        detached: true,
        stdio: 'ignore',
    });
};
