import { dirname, join } from 'path';
import process, { version as nodejsVersion } from 'process';
import { fileURLToPath } from 'url';
import { isCI } from 'ci-info';
// @ts-expect-error TS(7034) FIXME: Variable 'execa' implicitly has type 'any' in some... Remove this comment to see the full error message
import execa from '../execa.mjs';
import getGlobalConfig from '../get-global-config.mjs';
import { isTelemetryDisabled, cliVersion } from './utils.mjs';
import isValidEventName from './validation.mjs';
const dirPath = dirname(fileURLToPath(import.meta.url));
/**
 * @param {'track' | 'identify'} type
 * @param {object} payload
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'type' implicitly has an 'any' type.
function send(type, payload) {
    const requestFile = join(dirPath, 'request.mjs');
    const options = JSON.stringify({
        data: payload,
        type,
    });
    const args = /** @type {const} */ ([process.execPath, [requestFile, options]]);
    if (process.env.NETLIFY_TEST_TELEMETRY_WAIT === 'true') {
        // @ts-expect-error TS(7005) FIXME: Variable 'execa' implicitly has an 'any' type.
        return execa(...args, {
            stdio: 'inherit',
        });
    }
    // spawn detached child process to handle send
    // @ts-expect-error TS(7005) FIXME: Variable 'execa' implicitly has an 'any' type.
    execa(...args, {
        detached: true,
        stdio: 'ignore',
    }).unref();
}
const eventConfig = {
    // Namespace of current application
    projectName: 'cli',
    // Allowed objects
    objects: [
        // example cli:sites_created
        'sites',
        // example cli:user_signup
        'user',
    ],
};
/**
 * Tracks a custom event with the provided payload
 * @param {string} eventName
 * @param {{status?: string, duration?: number, [key: string]: unknown}} [payload]
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'eventName' implicitly has an 'any' type... Remove this comment to see the full error message
export async function track(eventName, payload = {}) {
    if (isCI) {
        return;
    }
    const globalConfig = await getGlobalConfig();
    if (isTelemetryDisabled(globalConfig)) {
        return;
    }
    const [userId, cliId] = [globalConfig.get('userId'), globalConfig.get('cliId')];
    // automatically add `cli:` prefix if missing
    if (!eventName.includes('cli:')) {
        eventName = `cli:${eventName}`;
    }
    // event 'cli:command' bypasses validation
    const isValid = eventName === 'cli:command' ? () => true : isValidEventName;
    // to ensure clean data, validate event name
    if (!isValid(eventName, eventConfig)) {
        return false;
    }
    // @ts-expect-error TS(2339) FIXME: Property 'duration' does not exist on type '{}'.
    const { duration, status, ...properties } = payload;
    const defaultData = {
        event: eventName,
        userId,
        anonymousId: cliId,
        duration,
        status,
        properties: { ...properties, nodejsVersion, cliVersion },
    };
    return send('track', defaultData);
}
/**
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.email
 * @param {string} payload.userId
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'payload' implicitly has an 'any' type.
export async function identify(payload) {
    if (isCI) {
        return;
    }
    const globalConfig = await getGlobalConfig();
    if (isTelemetryDisabled(globalConfig)) {
        return;
    }
    const cliId = globalConfig.get('cliId');
    const { email, name, userId } = payload;
    const defaultTraits = {
        name,
        email,
        cliId,
    };
    const identifyData = {
        anonymousId: cliId,
        userId,
        traits: { ...defaultTraits, ...payload },
    };
    return send('identify', identifyData);
}
