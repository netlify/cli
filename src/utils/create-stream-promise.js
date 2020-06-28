function createStreamPromise(stream, timeoutSeconds, bytesLimit = 1024 * 1024 * 6) {
  return new Promise(function(resolve, reject) {
    let data = []
    let dataLength = 0

    let timeoutId = null
    if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
      timeoutId = setTimeout(() => {
        data = null
        reject(new Error('Request timed out waiting for body'))
      }, timeoutSeconds * 1000)
    }

    stream.on('data', function(chunk) {
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

    stream.on('error', function(error) {
      data = null
      reject(error)
      clearTimeout(timeoutId)
    })
    stream.on('end', function() {
      clearTimeout(timeoutId)
      if (data) {
        resolve(Buffer.concat(data))
      }
    })
  })
}

module.exports = { createStreamPromise }
