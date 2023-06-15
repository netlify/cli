import { Readable } from 'stream'

export default class ResultReadStream extends Readable {
  #port
  #started = false
  /**
   *
   * @param {import('worker_threads').MessagePort} port
   * @param {import('stream').ReadableOptions} options
   */
  constructor(port, options) {
    super(options)

    this.#port = port
  }

  start() {
    if (this.#started) return
    this.#started = true

    this.#port.once('close', () => {
      // send stream ending EOF signal
      this.push(null)
      this.#port.removeAllListeners()
    })

    this.#port.once('messageerror', (error) => {
      throw error
    })

    // MessagePort will start receiving messages as soon as this listener is attached
    this.#port.on('message', (message) => {
      this.push(message)
    })
  }

  // eslint-disable-next-line no-underscore-dangle
  _read() {
    this.start()
  }
}
