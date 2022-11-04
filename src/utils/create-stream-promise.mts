// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'SEC_TO_MIL... Remove this comment to see the full error message
const SEC_TO_MILLISEC = 1e3

// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createStre... Remove this comment to see the full error message
const createStreamPromise = function (stream: $TSFixMe, timeoutSeconds: $TSFixMe, bytesLimit = DEFAULT_BYTES_LIMIT) {
  return new Promise(function streamPromiseFunc(resolve, reject) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    let data: $TSFixMe = []
    let dataLength = 0

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    let timeoutId: $TSFixMe = null
    if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
      timeoutId = setTimeout(() => {
        data = null
        reject(new Error('Request timed out waiting for body'))
      }, timeoutSeconds * SEC_TO_MILLISEC)
    }

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    stream.on('data', function onData(chunk: $TSFixMe) {
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

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    stream.on('error', function onError(error: $TSFixMe) {
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

module.exports = { createStreamPromise }
