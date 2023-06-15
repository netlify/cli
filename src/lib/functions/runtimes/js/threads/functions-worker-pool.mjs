import { Tinypool } from 'tinypool'

import ResultReadStream from './result-read-stream.mjs'

const workerURL = new URL('worker.mjs', import.meta.url).href

/**
 * This implements a worker pool which:
 * - based on tinypool (https://github.com/tinylibs/tinypool)
 * - executes lambda functions in threads
 * - starts the pool when the first function is executed
 * - leaves threads running forever
 * - has an option to restart (on file change for example)
 * - runs 1 thread per physical CPU core (default of tinypool)
 */
export default class FunctionsWorkerPool {
  /** @type {Tinypool} */
  #pool

  #createNewWorkerPool() {
    this.#pool = new Tinypool({
      filename: workerURL,
      // leave the workers running for ever, they weill be restarted on file change
      idleTimeout: Number.POSITIVE_INFINITY,
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

  async restart() {
    if (!this.#pool) return

    await this.#pool.destroy()
    this.#createNewWorkerPool()
  }
}
