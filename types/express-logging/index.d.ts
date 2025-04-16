declare module 'express-logging' {
  import { RequestHandler } from 'express';
  
  interface LoggerOptions {blacklist?: string[]}
  
  interface Logger {
    info(...args: unknown[]): void;
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    debug?(...args: unknown[]): void;
    log(...args: unknown[]): void;
  }
  
  function expressLogging(logger?: Logger, options?: LoggerOptions): RequestHandler;
  
  export default expressLogging;
}
