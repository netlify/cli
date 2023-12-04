import { Buffer } from 'buffer'
import { Readable } from 'stream'

const SEC_TO_MILLISEC = 1e3

// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6

const createStreamPromise = (
  stream: Readable,
  timeoutSeconds: number,
  bytesLimit = DEFAULT_BYTES_LIMIT,
): Promise<Buffer> =>
  new Promise(function streamPromiseFunc(resolve, reject) {
    let data: Buffer[] | null = []
    let dataLength = 0

    let timeoutId: NodeJS.Timeout
    if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
      timeoutId = setTimeout(() => {
        data = null
        reject(new Error('Request timed out waiting for body'))
      }, timeoutSeconds * SEC_TO_MILLISEC)
    }

    stream.on('data', function onData(chunk: Buffer) {
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

    stream.on('error', function onError(error) {
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
  })

export default createStreamPromise
