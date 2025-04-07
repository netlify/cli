// This module is "TypeScript" but contains no actual type annotations, so
// the resulting `.d.ts` file is just useless `any`s.
declare module 'lambda-local' {
  declare interface Options {
    clientContext?: string | Record<string, unknown>
    environment?: Record<string, string | undefined>
    esm?: boolean
    event: Record<string, unknown>
    lambdaFunc?: unknown
    lambdaPath?: string
    region?: string
    timeoutMs?: number
    verboseLevel?: -1 | 0 | 1 | 2 | 3
  }

  // See https://github.com/ashiina/lambda-local/blob/8914e6804533450fa68c56fe6c34858b645735d0/src/lambdalocal.ts#L110
  // But this whole thing is kind of a lie (we're exercising a code path where the `event` we pass in is returned, so
  // this is just our type we happen to define.
  declare interface LambdaEvent {
    body?: NodeJS.ReadableStream | string | undefined
    headers?: Record<string, string> | undefined
    level?: unknown
    multiValueHeaders?: Record<string, string[]> | undefined
    isBase64Encoded?: boolean
    statusCode?: number | undefined
  }

  export declare function getLogger(): { level: string }
  export declare function execute(opts: Options): Promise<LambdaEvent>
}
