import { Buffer } from 'buffer'
import type { Readable } from 'stream'

const SEC_TO_MILLISEC = 1e3

// 6 MiB
const DEFAULT_BYTES_LIMIT = 6e6

export class StreamBodyTooBigError extends Error {
  constructor() {
    super('Stream body too big')
    this.name = 'StreamBodyTooBigError'
  }
}

export class StreamTimeoutError extends Error {
  constructor() {
    super('Request timed out waiting for body')
    this.name = 'StreamTimeoutError'
  }
}

const createStreamPromise = function (
  stream: Readable,
  timeoutSeconds: number,
  bytesLimit = DEFAULT_BYTES_LIMIT,
): Promise<Buffer> {
  return new Promise(function streamPromiseFunc(resolve, reject) {
    let data: Buffer[] | null = []
    let dataLength = 0

    let timeoutId: NodeJS.Timeout | null = null
    if (timeoutSeconds != null && Number.isFinite(timeoutSeconds)) {
      timeoutId = setTimeout(() => {
        data = null
        reject(new StreamTimeoutError())
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
        reject(new StreamBodyTooBigError())
      } else {
        data.push(chunk)
      }
    })

    stream.on('error', function onError(error) {
      data = null
      reject(error)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    })
    stream.on('end', function onEnd() {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (data) {
        resolve(Buffer.concat(data))
      }
    })
  })
}

export default createStreamPromise
