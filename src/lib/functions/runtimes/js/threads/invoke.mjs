import process from 'process'
import { MessageChannel, isMainThread, parentPort, workerData } from 'worker_threads'

import lambdaLocal from '@skn0tt/lambda-local'
import { isStream } from 'is-stream'

import { SECONDS_TO_MILLISECONDS } from '../constants.mjs'

import ResultWriteStream from './result-write-stream.mjs'

if (isMainThread) {
  throw new Error(`Do not import "${import.meta.url}" in the main thread.`)
}

try {
  const { clientContext, event, lambdaPath, timeout } = workerData

  // eslint-disable-next-line import/no-dynamic-require
  const lambdaFunc = await import(lambdaPath)

  const result = await lambdaLocal.execute({
    clientContext,
    event,
    lambdaFunc,
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
    verboseLevel: 0,
  })

  const transferList = []

  // When the result body is a StreamResponse we have to create a new MessageChannel
  // where we can send the data to the main thread.
  if (isStream(result.body)) {
    const { port1, port2 } = new MessageChannel()

    const resultStream = new ResultWriteStream(port2)
    result.body.pipe(resultStream)

    // when the body is a MessagePort the main thread will stream the data from it
    result.body = port1
    transferList.push(port1)
  }

  parentPort.postMessage(result, transferList)
} catch (error) {
  console.error(error)

  process.exit(1)
}
