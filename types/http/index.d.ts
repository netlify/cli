declare module 'http' {
  import type { Buffer } from 'buffer'
  import type { ServerOptions } from 'http-proxy'

  // This is only necessary because we're attaching custom junk to the `req` given to us
  // by the `http-proxy` module. Since it in turn imports its request object type from `http`,
  // we have no choice but to augment the `http` module itself globally.
  // NOTE: to be extra clear, this is *augmenting* the existing type:
  // https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces.
  interface IncomingMessage {
    originalBody?: Buffer | null
    protocol?: string
    hostname?: string
    __expectHeader?: string
    alternativePaths?: string[]
    proxyOptions: ServerOptions
  }
}
