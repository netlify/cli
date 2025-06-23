import { platform } from 'process';
import fetch from 'node-fetch';
import pWaitFor from 'p-wait-for';
import { v4 as uuidv4 } from 'uuid';
import { fetchLatestVersion, shouldFetchLatestVersion } from '../lib/exec-fetcher.js';
import { getPathInHome } from '../lib/settings.js';
import { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, exit, log } from './command-helpers.js';
import execa from './execa.js';
const PACKAGE_NAME = 'live-tunnel-client';
const EXEC_NAME = PACKAGE_NAME;
const SLUG_LOCAL_STATE_KEY = 'liveTunnelSlug';
// 1 second
const TUNNEL_POLL_INTERVAL = 1e3;
// 5 minutes
const TUNNEL_POLL_TIMEOUT = 3e5;
const createTunnel = async function ({ netlifyApiToken, siteId, slug, }) {
    await installTunnelClient();
    const url = `https://api.netlify.com/api/v1/live_sessions?site_id=${siteId}&slug=${slug}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${netlifyApiToken}`,
        },
        body: JSON.stringify({}),
    });
    const data = await response.json();
    if (response.status !== 201) {
        // TODO(serhalp): Use typed `netlify` API client?
        throw new Error(data != null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : '');
    }
    return data;
};
const connectTunnel = function ({ localPort, netlifyApiToken, session, }) {
    const execPath = getPathInHome(['tunnel', 'bin', EXEC_NAME]);
    const args = ['connect', '-s', session.id, '-t', netlifyApiToken, '-l', localPort.toString()];
    if (process.env.DEBUG) {
        args.push('-v');
        log(execPath, args.toString());
    }
    const ps = execa(execPath, args, { stdio: 'inherit' });
    void ps.on('close', (code) => exit(code ?? undefined));
    void ps.on('SIGINT', () => exit());
    void ps.on('SIGTERM', () => exit());
};
const installTunnelClient = async function () {
    const binPath = getPathInHome(['tunnel', 'bin']);
    const shouldFetch = await shouldFetchLatestVersion({
        binPath,
        packageName: PACKAGE_NAME,
        execArgs: ['version'],
        pattern: `${PACKAGE_NAME}\\/v?([^\\s]+)`,
        execName: EXEC_NAME,
    });
    if (!shouldFetch) {
        return;
    }
    log(`${NETLIFYDEVLOG} Installing Live Tunnel Client`);
    await fetchLatestVersion({
        packageName: PACKAGE_NAME,
        execName: EXEC_NAME,
        destination: binPath,
        extension: platform === 'win32' ? 'zip' : 'tar.gz',
    });
};
export const startLiveTunnel = async ({ localPort, netlifyApiToken, siteId, slug, }) => {
    if (!siteId) {
        console.error(`${NETLIFYDEVERR} Error: no project ID defined, did you forget to run ${chalk.yellow('netlify init')} or ${chalk.yellow('netlify link')}?`);
        return exit(1);
    }
    if (!netlifyApiToken) {
        console.error(`${NETLIFYDEVERR} Error: no Netlify auth token defined, did you forget to run ${chalk.yellow('netlify login')} or define 'NETLIFY_AUTH_TOKEN'?`);
        return exit(1);
    }
    const session = await createTunnel({
        siteId,
        netlifyApiToken,
        slug,
    });
    const isLiveTunnelReady = async () => {
        const url = `https://api.netlify.com/api/v1/live_sessions/${session.id}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${netlifyApiToken}`,
            },
        });
        const data = await response.json();
        if (response.status !== 200) {
            // TODO(serhalp): Use typed `netlify` API client?
            throw new Error(data != null && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
                ? data.message
                : '');
        }
        return data.state === 'online';
    };
    connectTunnel({ session, netlifyApiToken, localPort });
    // Waiting for the live session to have a state of `online`.
    await pWaitFor(isLiveTunnelReady, {
        interval: TUNNEL_POLL_INTERVAL,
        timeout: TUNNEL_POLL_TIMEOUT,
    });
    return session.session_url;
};
export const getLiveTunnelSlug = (state, override) => {
    if (override !== undefined) {
        return override;
    }
    const newSlug = generateRandomSlug();
    try {
        const existingSlug = state.get(SLUG_LOCAL_STATE_KEY);
        if (existingSlug !== undefined) {
            return existingSlug;
        }
        state.set(SLUG_LOCAL_STATE_KEY, newSlug);
    }
    catch (error) {
        log(`${NETLIFYDEVERR} Could not read or write local state file: ${error instanceof Error ? error.message : error?.toString() ?? ''}`);
    }
    return newSlug;
};
const generateRandomSlug = () => uuidv4().slice(0, 8);
//# sourceMappingURL=live-tunnel.js.map