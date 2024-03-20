import { createServer } from 'net';
import process from 'process';
import { isMainThread, workerData, parentPort } from 'worker_threads';
import { isStream } from 'is-stream';
import lambdaLocal from 'lambda-local';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'sour... Remove this comment to see the full error message
import sourceMapSupport from 'source-map-support';
if (isMainThread) {
    throw new Error(`Do not import "${import.meta.url}" in the main thread.`);
}
sourceMapSupport.install();
lambdaLocal.getLogger().level = 'alert';
const { clientContext, entryFilePath, environment = {}, event, timeoutMs } = workerData;
// Injecting into the environment any properties passed in by the parent.
for (const key in environment) {
    process.env[key] = environment[key];
}
const lambdaFunc = await import(entryFilePath);
const result = await lambdaLocal.execute({
    clientContext,
    event,
    lambdaFunc,
    region: 'dev',
    timeoutMs,
    verboseLevel: 3,
});
// When the result body is a StreamResponse
// we open up a http server that proxies back to the main thread.
// @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
if (result && isStream(result.body)) {
    // @ts-expect-error TS(2339) FIXME: Property 'body' does not exist on type 'unknown'.
    const { body } = result;
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    delete result.body;
    await new Promise((resolve, reject) => {
        const server = createServer((socket) => {
            body.pipe(socket).on('end', () => server.close());
        });
        server.on('error', (error) => {
            reject(error);
        });
        server.listen({ port: 0, host: 'localhost' }, () => {
            // @ts-expect-error TS(2339) FIXME: Property 'port' does not exist on type 'string | A... Remove this comment to see the full error message
            const { port } = server.address();
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            result.streamPort = port;
            // @ts-expect-error TS(2794) FIXME: Expected 1 arguments, but got 0. Did you forget to... Remove this comment to see the full error message
            resolve();
        });
    });
}
// @ts-expect-error TS(2531) FIXME: Object is possibly 'null'.
parentPort.postMessage(result);
