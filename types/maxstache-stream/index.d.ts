declare module 'maxstache-stream' {
  import { Transform } from 'stream';

  function maxstacheStream(vars: Record<string, string>): Transform;
  
  export default maxstacheStream;
}
