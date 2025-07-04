import { Buffer } from 'buffer';
const SEC_TO_MILLISEC = 1e3;
// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6;
const createStreamPromise = function (stream, timeoutSeconds, bytesLimit = DEFAULT_BYTES_LIMIT) {
    return new Promise(function streamPromiseFunc(resolve, reject) {
        let data = [];
        let dataLength = 0;
        // @ts-expect-error TS(7034) FIXME: Variable 'timeoutId' implicitly has type 'any' in ... Remove this comment to see the full error message
        let timeoutId = null;
        if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
            timeoutId = setTimeout(() => {
                data = null;
                reject(new Error('Request timed out waiting for body'));
            }, timeoutSeconds * SEC_TO_MILLISEC);
        }
        stream.on('data', function onData(chunk) {
            if (!Array.isArray(data)) {
                // Stream harvesting closed
                return;
            }
            dataLength += chunk.length;
            if (dataLength > bytesLimit) {
                data = null;
                reject(new Error('Stream body too big'));
            }
            else {
                data.push(chunk);
            }
        });
        stream.on('error', function onError(error) {
            data = null;
            reject(error);
            clearTimeout(timeoutId);
        });
        stream.on('end', function onEnd() {
            clearTimeout(timeoutId);
            if (data) {
                // @ts-expect-error TS(7005) FIXME: Variable 'data' implicitly has an 'any[]' type.
                resolve(Buffer.concat(data));
            }
        });
    });
};
export default createStreamPromise;
//# sourceMappingURL=create-stream-promise.js.map