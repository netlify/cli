// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')

const SEC_TO_MILLISEC = 1e3

// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'createStre... Remove this comment to see the full error message
const createStreamPromise = function (stream: any, timeoutSeconds: any, bytesLimit = DEFAULT_BYTES_LIMIT) {
  return new Promise(function streamPromiseFunc(resolve, reject) {
    let data: any = []
    let dataLength = 0

    let timeoutId: any = null
    if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
      timeoutId = setTimeout(() => {
        data = null
        reject(new Error('Request timed out waiting for body'))
      }, timeoutSeconds * SEC_TO_MILLISEC)
    }

    stream.on('data', function onData(chunk: any) {
      if (!Array.isArray(data)) {
        // Stream harvesting closed
        return
      }
      dataLength += chunk.length
      if (dataLength > bytesLimit) {
        data = null
        reject(new Error('Stream body too big'))
      } else {
        data.push(chunk)
      }
    })

    stream.on('error', function onError(error: any) {
      data = null
      reject(error)
      clearTimeout(timeoutId)
    })
    stream.on('end', function onEnd() {
      clearTimeout(timeoutId)
      if (data) {
        resolve(Buffer.concat(data))
      }
    })
  });
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { createStreamPromise }
