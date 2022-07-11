interface ServerLocation {
  /** The port to wait for */
  port: number;

  /** The host to check
   * (defaults to 'localhost') */
  host?: string;

  /** Set to 'http' to test an HTTP request as well */
  protocol?: 'http';

  /** If using the 'http' protocol, the path to check
   * (defaults to '/' if protocol is 'http') */
  path?: string;

  /** The number of milliseconds to wait on each connection attempt
   * (defaults to 1000) */
  interval?: number;

  /** The number of milliseconds to wait before giving up
   * (defaults to 0) */
  timeout?: number;

  /** Whether to wait for DNS to resolve
   * (defaults to false) */
  waitForDns?: boolean;

  /** Output mode
   * (defaults to 'dots') */
  output?: 'dots' | 'silent';
}

declare const waitPort: (server: ServerLocation) => Promise<boolean>;

export = waitPort;
