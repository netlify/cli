import { MessagePort } from 'worker_threads'

import { Tinypool } from 'tinypool'

import ResultReadStream from './result-read-stream.mjs'

const workerURL = new URL('worker.mjs', import.meta.url).href

/**
 * This implements a worker pool which:
 * - based on tinypool (https://github.com/tinylibs/tinypool)
 * - executes lambda functions in threads
 * - starts the pool when the first function is executed
 * - runs 1 thread per physical CPU core (default of tinypool)
 * - always keeps enough threads on standby to reduce latency
 * - after every function the worker is restarted
 */
export default class FunctionsWorkerPool {
  /** @type {Tinypool} */
  #pool

  #createNewWorkerPool() {
    this.#pool = new Tinypool({
      filename: workerURL,
      // Ensures the worker is restarted after finishing
      isolateWorkers: true,
      // atomics do not work with our setup for streaming responses
      // we use a custom MessagePort for receiving the streaming response and atomics
      // do block the event loop in the worker and make the port not execute and send any data.
      useAtomics: false,
    })
  }

  async run(data) {
    if (!this.#pool) {
      this.#createNewWorkerPool()
    }

    const result = await this.#pool.run(data)

    if (result && result.body instanceof MessagePort) {
      result.body = new ResultReadStream(result.body)
    }

    return result
  }
}
