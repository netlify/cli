import { Buffer } from 'buffer'
import http from 'http'
import { Socket } from 'net'

/**
 * Extends the native `http.IncomingMessage` class with an `originalBody`
 * property that exposes the request body as a buffer.
 */
export class IncomingRequest extends http.IncomingMessage {
  originalBody: Buffer | null

  constructor(socket: Socket) {
    super(socket)

    this.originalBody = null
  }
}
