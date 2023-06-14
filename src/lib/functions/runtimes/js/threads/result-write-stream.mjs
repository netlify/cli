/* eslint-disable promise/prefer-await-to-callbacks, no-underscore-dangle */
import { Writable } from 'stream'

export default class ResultWriteStream extends Writable {
  #port

  /**
   *
   * @param {import('worker_threads').MessagePort} port
   * @param {import('stream').WritableOptions} options
   */
  constructor(port, options) {
    super(options)

    this.#port = port
  }

  _write(chunk, _encoding, callback) {
    try {
      this.#port.postMessage(chunk)
    } catch (error) {
      return callback(error)
    }

    callback()
  }

  _final(callback) {
    this.#port.close()
    callback()
  }
}
/* eslint-enable promise/prefer-await-to-callbacks, no-underscore-dangle */
