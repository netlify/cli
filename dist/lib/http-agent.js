import { readFile } from 'fs/promises';
import { HttpsProxyAgent } from 'https-proxy-agent';
import waitPort from 'wait-port';
import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js';
// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
// Maybe replace with https://github.com/delvedor/hpagent
// @ts-expect-error TS(2507) FIXME: Type 'typeof createHttpsProxyAgent' is not a const... Remove this comment to see the full error message
class HttpsProxyAgentWithCA extends HttpsProxyAgent {
    // @ts-expect-error TS(7006) FIXME: Parameter 'opts' implicitly has an 'any' type.
    constructor(opts) {
        super(opts);
        // @ts-expect-error TS(2339) FIXME: Property 'ca' does not exist on type 'HttpsProxyAg... Remove this comment to see the full error message
        this.ca = opts.ca;
    }
    // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
    callback(req, opts) {
        return super.callback(req, {
            ...opts,
            // @ts-expect-error TS(2339) FIXME: Property 'ca' does not exist on type 'HttpsProxyAg... Remove this comment to see the full error message
            ...(this.ca && { ca: this.ca }),
        });
    }
}
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
// 50 seconds
const AGENT_PORT_TIMEOUT = 50;
export const tryGetAgent = async ({ certificateFile, httpProxy, }) => {
    if (!httpProxy) {
        return {};
    }
    let proxyUrl;
    try {
        proxyUrl = new URL(httpProxy);
    }
    catch {
        return { error: `${httpProxy} is not a valid URL` };
    }
    const scheme = proxyUrl.protocol.slice(0, -1);
    if (!['http', 'https'].includes(scheme)) {
        return { error: `${httpProxy} must have a scheme of http or https` };
    }
    let port;
    try {
        port = await waitPort({
            port: Number.parseInt(proxyUrl.port) || (scheme === 'http' ? DEFAULT_HTTP_PORT : DEFAULT_HTTPS_PORT),
            host: proxyUrl.hostname,
            timeout: AGENT_PORT_TIMEOUT,
            output: 'silent',
        });
    }
    catch (error) {
        // unknown error
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        return { error: `${httpProxy} is not available.`, message: error.message };
    }
    if (!port.open) {
        // timeout error
        return { error: `Could not connect to '${httpProxy}'` };
    }
    let response = {};
    let certificate;
    if (certificateFile) {
        try {
            certificate = await readFile(certificateFile);
        }
        catch (error) {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            response = { warning: `Could not read certificate file '${certificateFile}'.`, message: error.message };
        }
    }
    const opts = {
        port: proxyUrl.port,
        host: proxyUrl.host,
        hostname: proxyUrl.hostname,
        protocol: proxyUrl.protocol,
        ca: certificate,
    };
    const agent = new HttpsProxyAgentWithCA(opts);
    response = { ...response, agent };
    return response;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'certificateFile' implicitly has a... Remove this comment to see the full error message
export const getAgent = async ({ certificateFile, httpProxy }) => {
    // @ts-expect-error TS(2339) FIXME: Property 'agent' does not exist on type '{ error?:... Remove this comment to see the full error message
    const { agent, error, message, warning } = await tryGetAgent({ httpProxy, certificateFile });
    if (error) {
        log(NETLIFYDEVERR, error, message || '');
        exit(1);
    }
    if (warning) {
        log(NETLIFYDEVWARN, warning, message || '');
    }
    return agent;
};
//# sourceMappingURL=http-agent.js.map