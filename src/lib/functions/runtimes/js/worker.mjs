import { createServer } from 'net'
import { isMainThread, workerData, parentPort } from 'worker_threads'

import { isStream } from 'is-stream'
import lambdaLocal from 'lambda-local'
import sourceMapSupport from 'source-map-support'

if (isMainThread) {
  throw new Error(`Do not import "${import.meta.url}" in the main thread.`)
}

sourceMapSupport.install()

lambdaLocal.getLogger().level = 'alert'

const { clientContext, entryFilePath, event, timeoutMs } = workerData

const lambdaFunc = await import(entryFilePath)

const result = await lambdaLocal.execute({
  clientContext,
  event,
  lambdaFunc,
  region: 'dev',
  timeoutMs,
  verboseLevel: 3,
})

// When the result body is a StreamResponse
// we open up a http server that proxies back to the main thread.
if (result && isStream(result.body)) {
  const { body } = result
  delete result.body
  await new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      body.pipe(socket).on('end', () => server.close())
    })
    server.on('error', (error) => {
      reject(error)
    })
    server.listen({ port: 0, host: 'localhost' }, () => {
      const { port } = server.address()
      result.streamPort = port
      resolve()
    })
  })
}

parentPort.postMessage(result)
