import { createServer } from 'net';
import process from 'process';
import { isMainThread, workerData, parentPort } from 'worker_threads';
import { isStream } from 'is-stream';
import lambdaLocal from 'lambda-local';
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
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const lambdaFunc = await import(entryFilePath);
const lambdaEvent = await lambdaLocal.execute({
    clientContext,
    event,
    lambdaFunc,
    region: 'dev',
    timeoutMs,
    verboseLevel: 3,
});
let streamPort = null;
// When the result body is a StreamResponse
// we open up a http server that proxies back to the main thread.
// TODO(serhalp): Improve `LambdaEvent` type. It sure would be nice to keep it simple as it
// is now, but technically this is an arbitrary type from the user function return...
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (lambdaEvent != null && isStream(lambdaEvent.body)) {
    const { body } = lambdaEvent;
    delete lambdaEvent.body;
    await new Promise((resolve, reject) => {
        const server = createServer((socket) => {
            body.pipe(socket).on('end', () => server.close());
        });
        server.on('error', (error) => {
            reject(error);
        });
        server.listen({ port: 0, host: 'localhost' }, () => {
            const address = server.address();
            if (address == null || typeof address !== 'object') {
                throw new Error('Expected server.address() to return an object');
            }
            streamPort = address.port;
            resolve(undefined);
        });
    });
}
// See TODO above.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (lambdaEvent == null) {
    parentPort?.postMessage(lambdaEvent);
}
else {
    //  Looks like some sort of eslint bug...? It thinks `streamPort` can't be null here
    //  eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const message = { ...lambdaEvent, ...(streamPort != null ? { streamPort } : {}) };
    parentPort?.postMessage(message);
}
//# sourceMappingURL=worker.js.map