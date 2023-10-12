import { EventEmitter } from 'node:events'

import { URLPattern } from 'urlpattern-polyfill'

const pattern = new URLPattern({ pathname: '/.netlify/pubsub/:topic' })

export class PubSubServer {
  #messages = new EventEmitter()

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @returns {"skip" | undefined}
   */
  handleRequest(req, res) {
    const match = pattern.exec(req.url, 'http://localhost')
    if (!match) return 'skip'

    const { topic } = match.pathname.groups
    if (!topic) {
      res.statusCode = 400
      res.write('Missing topic in URL')
      res.end()
      return
    }

    if (req.method === 'GET') {
      this.#subscribe(req, res, topic)
      return true
    }
    if (req.method === 'POST') {
      this.#publish(req, res, topic)
      return true
    }

    res.statusCode = 405
    res.end()
    return true
  }

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @param {string} topic
   */
  #subscribe(req, res, topic) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.statusCode = 200

    const sendPing = () => res.write('event: ping\n\n')
    sendPing()

    const pingInterval = setInterval(sendPing, 1000)

    const sendMessage = (message) => res.write(`data: ${message}\n\n`)

    this.#messages.on(topic, sendMessage)

    req.on('end', () => {
      clearInterval(pingInterval)
      this.#messages.off(topic, sendMessage)
    })
  }

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * * @param {string} topic
   */
  async #publish(req, res, topic) {
    const message = await req.originalBody
    this.#messages.emit(topic, message)
    res.statusCode = 202
    res.end()
  }
}
