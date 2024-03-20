import { dirname, join } from 'path';
import process, { version as nodejsVersion } from 'process';
import { fileURLToPath } from 'url';
import { isCI } from 'ci-info';
import execa from '../execa.js';
import getGlobalConfig from '../get-global-config.js';
import { isTelemetryDisabled, cliVersion } from './utils.js';
import isValidEventName from './validation.js';
const dirPath = dirname(fileURLToPath(import.meta.url));
function send(type, payload) {
    const requestFile = join(dirPath, 'request.js');
    const options = JSON.stringify({
        data: payload,
        type,
    });
    const args = [process.execPath, [requestFile, options]];
    if (process.env.NETLIFY_TEST_TELEMETRY_WAIT === 'true') {
        return execa(...args, {
            stdio: 'inherit',
        });
    }
    // spawn detached child process to handle send
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
 */
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
