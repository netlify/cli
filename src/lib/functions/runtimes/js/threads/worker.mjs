import { MessageChannel, isMainThread } from 'worker_threads'

import lambdaLocal from '@skn0tt/lambda-local'
import { isStream } from 'is-stream'
import { kTransferable, kValue, Tinypool } from 'tinypool'

import { SECONDS_TO_MILLISECONDS } from '../constants.mjs'

import ResultWriteStream from './result-write-stream.mjs'

if (isMainThread) {
  throw new Error(`Do not import "${import.meta.url}" in the main thread.`)
}

lambdaLocal.getLogger().level = 'warn'

const worker = async function (workerData) {
  try {
    const { clientContext, event, lambdaPath, timeout } = workerData

    // eslint-disable-next-line import/no-dynamic-require
    const lambdaFunc = await import(lambdaPath)

    const result = await lambdaLocal.execute({
      clientContext,
      event,
      lambdaFunc,
      timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
      verboseLevel: 3,
    })

    // When the result body is a StreamResponse we have to create a new MessageChannel
    // where we can send the data to the main thread.
    if (result && isStream(result.body)) {
      const { port1, port2 } = new MessageChannel()

      const resultStream = new ResultWriteStream(port2)
      result.body.pipe(resultStream)

      // when the body is a MessagePort the main thread will stream the data from it
      result.body = port1

      // tinypool requires us to set these and use move() in order to be able to transfer the MessagePort to the main thread
      return Tinypool.move({
        get [kValue]() {
          return result
        },
        get [kTransferable]() {
          return [port1]
        },
      })
    }

    return result
  } catch (error) {
    console.error(error)

    throw error
  }
}

export default worker
