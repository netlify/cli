const fs = require('fs')

const backoff = require('backoff')
const pMap = require('p-map')

const { UPLOAD_INITIAL_DELAY, UPLOAD_MAX_DELAY, UPLOAD_RANDOM_FACTOR } = require('./constants')

const uploadFiles = async (api, deployId, uploadList, { concurrentUpload, maxRetry, statusCb }) => {
  if (!concurrentUpload || !statusCb || !maxRetry) throw new Error('Missing required option concurrentUpload')
  statusCb({
    type: 'upload',
    msg: `Uploading ${uploadList.length} files`,
    phase: 'start',
  })

  const uploadFile = async (fileObj, index) => {
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
        response = await await retryUpload(
          () =>
            api.uploadDeployFunction({
              body: readStreamCtor,
              deployId,
              name: encodeURI(normalizedPath),
              runtime,
            }),
          maxRetry,
        )
        break
      }
      default: {
        const error = new Error('File Object missing assetType property')
        error.fileObj = fileObj
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

const retryUpload = (uploadFn, maxRetry) =>
  new Promise((resolve, reject) => {
    let lastError
    const fibonacciBackoff = backoff.fibonacci({
      randomisationFactor: UPLOAD_RANDOM_FACTOR,
      initialDelay: UPLOAD_INITIAL_DELAY,
      maxDelay: UPLOAD_MAX_DELAY,
    })

    const tryUpload = async () => {
      try {
        const results = await uploadFn()
        return resolve(results)
      } catch (error) {
        lastError = error
        // observed errors: 408, 401 (4** swallowed), 502
        if (error.status >= 400 || error.name === 'FetchError') {
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

module.exports = { uploadFiles }
