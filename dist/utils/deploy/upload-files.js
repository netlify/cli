import fs from 'fs';
import backoff from 'backoff';
import pMap from 'p-map';
import { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } from './constants.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'api' implicitly has an 'any' type.
const uploadFiles = async (api, deployId, uploadList, { concurrentUpload, maxRetry, statusCb }) => {
    if (!concurrentUpload || !statusCb || !maxRetry)
        throw new Error('Missing required option concurrentUpload');
    statusCb({
        type: 'upload',
        msg: `Uploading ${uploadList.length} files`,
        phase: 'start',
    });
    // @ts-expect-error TS(7006) FIXME: Parameter 'fileObj' implicitly has an 'any' type.
    const uploadFile = async (fileObj, index) => {
        const { assetType, body, filepath, invocationMode, normalizedPath, runtime, timeout } = fileObj;
        const readStreamCtor = () => body ?? fs.createReadStream(filepath);
        statusCb({
            type: 'upload',
            msg: `(${index}/${uploadList.length}) Uploading ${normalizedPath}...`,
            phase: 'progress',
        });
        let response;
        switch (assetType) {
            case 'file': {
                response = await retryUpload(() => api.uploadDeployFile({
                    body: readStreamCtor,
                    deployId,
                    path: encodeURI(normalizedPath),
                }), maxRetry);
                break;
            }
            case 'function': {
                // @ts-expect-error TS(7006) FIXME: Parameter 'retryCount' implicitly has an 'any' typ... Remove this comment to see the full error message
                response = await retryUpload((retryCount) => {
                    const params = {
                        body: readStreamCtor,
                        deployId,
                        invocationMode,
                        timeout,
                        name: encodeURI(normalizedPath),
                        runtime,
                    };
                    if (retryCount > 0) {
                        // @ts-expect-error TS(2339) FIXME: Property 'xNfRetryCount' does not exist on type '{... Remove this comment to see the full error message
                        params.xNfRetryCount = retryCount;
                    }
                    return api.uploadDeployFunction(params);
                }, maxRetry);
                break;
            }
            default: {
                const error = new Error('File Object missing assetType property');
                // @ts-expect-error TS(2339) FIXME: Property 'fileObj' does not exist on type 'Error'.
                error.fileObj = fileObj;
                throw error;
            }
        }
        return response;
    };
    const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload });
    statusCb({
        type: 'upload',
        msg: `Finished uploading ${uploadList.length} assets`,
        phase: 'stop',
    });
    return results;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'uploadFn' implicitly has an 'any' type.
const retryUpload = (uploadFn, maxRetry) => new Promise((resolve, reject) => {
    // @ts-expect-error TS(7034) FIXME: Variable 'lastError' implicitly has type 'any' in ... Remove this comment to see the full error message
    let lastError;
    const fibonacciBackoff = backoff.fibonacci({
        randomisationFactor: UPLOAD_RANDOM_FACTOR,
        initialDelay: UPLOAD_INITIAL_DELAY,
        maxDelay: UPLOAD_MAX_DELAY,
    });
    const tryUpload = async (retryIndex = -1) => {
        try {
            const results = await uploadFn(retryIndex + 1);
            resolve(results);
            return;
        }
        catch (error) {
            lastError = error;
            // We don't need to retry for 400 or 422 errors
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.status === 400 || error.status === 422) {
                reject(error);
                return;
            }
            // observed errors: 408, 401 (4** swallowed), 502
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (error.status > 400 || error.name === 'FetchError') {
                fibonacciBackoff.backoff();
                return;
            }
            reject(error);
            return;
        }
    };
    fibonacciBackoff.failAfter(maxRetry);
    fibonacciBackoff.on('backoff', () => {
        // Do something when backoff starts, e.g. show to the
        // user the delay before next reconnection attempt.
    });
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    fibonacciBackoff.on('ready', tryUpload);
    fibonacciBackoff.on('fail', () => {
        // @ts-expect-error TS(7005) FIXME: Variable 'lastError' implicitly has an 'any' type.
        reject(lastError);
    });
    tryUpload();
});
export default uploadFiles;
//# sourceMappingURL=upload-files.js.map