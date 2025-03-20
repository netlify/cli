import type { Stream } from 'node:stream'

export const isStream = (stream: unknown): stream is Stream =>
  stream !== null && typeof stream === 'object' && typeof (stream as Stream).pipe === 'function'
