import { pathToFileURL } from 'url'
import { MessagePort, Worker } from 'worker_threads'

import ResultReadStream from './result-read-stream.mjs'

const workerURL = new URL('invoke.mjs', import.meta.url)

export const createFunctionWorker = ({ context, event, func, timeout }) => {
  const workerData = {
    clientContext: JSON.stringify(context),
    event,
    // If a function builder has defined a `buildPath` property, we use it.
    // Otherwise, we'll invoke the function's main file.
    // Because we use import() we have to use file:// URLs for windows
    lambdaPath: pathToFileURL((func.buildData && func.buildData.buildPath) || func.mainFile).href,
    timeout,
  }

  const worker = new Worker(workerURL, {
    workerData,
  })
  return new Promise((resolve, reject) => {
    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Lambda worker stopped with exit code ${code}`))
    })
    worker.on('message', (message) => {
      if (message && message.body instanceof MessagePort) {
        message.body = new ResultReadStream(message.body)
      }

      resolve(message)
    })
  })
}
