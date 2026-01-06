declare module 'https-proxy-agent' {
  import { Agent } from 'http';
  import { URL } from 'url';

  export class HttpsProxyAgent extends Agent {
    constructor(opts: HttpsProxyAgentOptions | string | URL);
  }

  export interface HttpsProxyAgentOptions {
    host: string;
    port: string;
    protocol: string;
    ca?: Buffer;
    [key: string]: any;
  }
}
