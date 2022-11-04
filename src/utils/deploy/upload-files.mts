
const fs = require('fs')

const backoff = require('backoff')
const pMap = require('p-map')


const { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } = require('./constants.mjs')


const uploadFiles = async (api: $TSFixMe, deployId: $TSFixMe, uploadList: $TSFixMe, {
  concurrentUpload,
  maxRetry,
  statusCb

}: $TSFixMe) => {
  if (!concurrentUpload || !statusCb || !maxRetry) throw new Error('Missing required option concurrentUpload')
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  
  const uploadFile = async (fileObj: $TSFixMe, index: $TSFixMe) => {
    const { assetType, filepath, normalizedPath, runtime } = fileObj
    const readStreamCtor = () => fs.createReadStream(filepath)

    statusCb({
      type: 'upload',
      msg: `(${index}/${uploadList.length}) Uploading ${normalizedPath}...`,
      phase: 'progress',
    })
    let response
    switch (assetType) {
      case 'file': {
        response = await retryUpload(
          () =>
            api.uploadDeployFile({
              body: readStreamCtor,
              deployId,
              path: encodeURI(normalizedPath),
            }),
          maxRetry,
        )
        break
      }
      case 'function': {
        
        response = await retryUpload((retryCount: $TSFixMe) => {
    const params = {
        body: readStreamCtor,
        deployId,
        name: encodeURI(normalizedPath),
        runtime,
    };
    if (retryCount > 0) {
        
        (params as $TSFixMe).xNfRetryCount = retryCount;
    }
    return api.uploadDeployFunction(params);
}, maxRetry);
        break
      }
      default: {
        // @ts-expect-error TS(7022): 'error' implicitly has type 'any' because it does ... Remove this comment to see the full error message
        const error = new Error('File Object missing assetType property')
        // @ts-expect-error TS(2448): Block-scoped variable 'error' used before its decl... Remove this comment to see the full error message
        (error as $TSFixMe).fileObj = fileObj;
        throw error
      }
    }

    return response
  }

  const results = await pMap(uploadList, uploadFile, { concurrency: concurrentUpload })
  statusCb({
    type: 'upload',
    msg: `Finished uploading ${uploadList.length} assets`,
    phase: 'stop',
  })
  return results
}


const retryUpload = (uploadFn: $TSFixMe, maxRetry: $TSFixMe) =>
  new Promise((resolve, reject) => {
    
    let lastError: $TSFixMe

    const fibonacciBackoff = backoff.fibonacci({
      randomisationFactor: UPLOAD_RANDOM_FACTOR,
      initialDelay: UPLOAD_INITIAL_DELAY,
      maxDelay: UPLOAD_MAX_DELAY,
    })

    const tryUpload = async (retryIndex = -1) => {
      try {
        const results = await uploadFn(retryIndex + 1)

        return resolve(results)
      } catch (error) {
        lastError = error

        // observed errors: 408, 401 (4** swallowed), 502
        
        if ((error as $TSFixMe).status >= 400 || (error as $TSFixMe).name === 'FetchError') {
          fibonacciBackoff.backoff()
          return
        }
        return reject(error)
      }
    }

    fibonacciBackoff.failAfter(maxRetry)

    fibonacciBackoff.on('backoff', () => {
      // Do something when backoff starts, e.g. show to the
      // user the delay before next reconnection attempt.
    })

    fibonacciBackoff.on('ready', tryUpload)

    fibonacciBackoff.on('fail', () => {
      reject(lastError)
    })

    tryUpload()
  })

export default { uploadFiles }
