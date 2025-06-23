import { Buffer } from 'buffer';
import { IncomingMessage } from 'http';
declare const createStreamPromise: (stream: IncomingMessage, timeoutSeconds: number, bytesLimit?: number) => Promise<Buffer>;
export default createStreamPromise;
//# sourceMappingURL=create-stream-promise.d.ts.map