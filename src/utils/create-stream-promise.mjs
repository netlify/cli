import { Buffer } from 'buffer';
const SEC_TO_MILLISEC = 1e3;
// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6;
// @ts-expect-error TS(7006) FIXME: Parameter 'stream' implicitly has an 'any' type.
const createStreamPromise = function (stream, timeoutSeconds, bytesLimit = DEFAULT_BYTES_LIMIT) {
    return new Promise(function streamPromiseFunc(resolve, reject) {
        // @ts-expect-error TS(7034) FIXME: Variable 'data' implicitly has type 'any[]' in som... Remove this comment to see the full error message
        let data = [];
        let dataLength = 0;
        // @ts-expect-error TS(7034) FIXME: Variable 'timeoutId' implicitly has type 'any' in ... Remove this comment to see the full error message
        let timeoutId = null;
        if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
            timeoutId = setTimeout(() => {
                // @ts-expect-error TS(2322) FIXME: Type 'null' is not assignable to type 'any[]'.
                data = null;
                reject(new Error('Request timed out waiting for body'));
            }, timeoutSeconds * SEC_TO_MILLISEC);
        }
        // @ts-expect-error TS(7006) FIXME: Parameter 'chunk' implicitly has an 'any' type.
        stream.on('data', function onData(chunk) {
            // @ts-expect-error TS(7005) FIXME: Variable 'data' implicitly has an 'any[]' type.
            if (!Array.isArray(data)) {
                // Stream harvesting closed
                return;
            }
            dataLength += chunk.length;
            if (dataLength > bytesLimit) {
                // @ts-expect-error TS(2322) FIXME: Type 'null' is not assignable to type 'any[]'.
                data = null;
                reject(new Error('Stream body too big'));
            }
            else {
                data.push(chunk);
            }
        });
        // @ts-expect-error TS(7006) FIXME: Parameter 'error' implicitly has an 'any' type.
        stream.on('error', function onError(error) {
            // @ts-expect-error TS(2322) FIXME: Type 'null' is not assignable to type 'any[]'.
            data = null;
            reject(error);
            // @ts-expect-error TS(7005) FIXME: Variable 'timeoutId' implicitly has an 'any' type.
            clearTimeout(timeoutId);
        });
        stream.on('end', function onEnd() {
            // @ts-expect-error TS(7005) FIXME: Variable 'timeoutId' implicitly has an 'any' type.
            clearTimeout(timeoutId);
            // @ts-expect-error TS(7005) FIXME: Variable 'data' implicitly has an 'any[]' type.
            if (data) {
                // @ts-expect-error TS(7005) FIXME: Variable 'data' implicitly has an 'any[]' type.
                resolve(Buffer.concat(data));
            }
        });
    });
};
export default createStreamPromise;
