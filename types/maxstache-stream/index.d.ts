declare module 'maxstache-stream' {
  import type { Transform } from 'stream'

  function maxstacheStream(vars: Record<string, string>): Transform

  export default maxstacheStream
}
