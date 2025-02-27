declare module 'http-proxy' {
  type Match = (
    | {
        from: string
        to: string
        host: string
        scheme: string
        status: number
        force: boolean
        negative: boolean
        proxyHeaders?: Record<string, string>
        signingSecret?: string
      }
    | {
        force404: true
      }
  ) & {
    force404?: boolean
    conditions: Record<string, string>
    exceptions: Record<string, string>
  }

  // TODO(serhalp) Refactor? This is super confusing. It appears to be simultaneously a set of standard options
  // supported by `http-proxy` but also a grab-bag of our own specific options conveniently attached to the same object.
  // NOTE: to be extra clear, this is *augmenting* the existing type:
  // https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces.
  interface ServerOptions {
    status?: number
    match: Match | null
    staticFile?: string | false
    // target: string
    publicFolder?: string | undefined
    functionsPort: number
    jwtRolePath: string
    framework?: string | undefined
    addonsUrls?: Record<string, string>
    functionsServer?: string | null
  }
}
