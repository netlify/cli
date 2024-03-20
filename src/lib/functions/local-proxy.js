import { stdout } from 'process';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module '@net... Remove this comment to see the full error message
import { getBinaryPath as getFunctionsProxyPath } from '@netlify/local-functions-proxy';
import execa from '../../utils/execa.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'binaryPath' implicitly has an 'an... Remove this comment to see the full error message
export const runFunctionsProxy = ({ binaryPath, context, directory, event, name, timeout }) => {
    const functionsProxyPath = getFunctionsProxyPath();
    const requestData = {
        resource: '',
        ...event,
        headers: {
            ...event.headers,
            'X-Amzn-Trace-Id': '1a2b3c4d5e6f',
        },
        requestContext: {
            ...context,
            httpMethod: event.httpMethod || 'GET',
            requestTimeEpoch: 0,
        },
    };
    if (functionsProxyPath === null) {
        throw new Error('Host machine does not support local functions proxy server');
    }
    const parameters = [
        '--event',
        JSON.stringify(requestData),
        '--command',
        binaryPath,
        '--working-dir',
        directory,
        '--name',
        name,
        '--timeout',
        `${timeout}s`,
    ];
    const proxyProcess = execa(functionsProxyPath, parameters);
    proxyProcess.stderr?.pipe(stdout);
    return proxyProcess;
};
