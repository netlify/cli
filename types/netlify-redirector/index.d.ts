declare module 'netlify-redirector' {
  export interface Options {
    jwtSecret?: string
    jwtRoleClaim?: string
  }
  export interface Request {
    scheme: string
    host: string
    path: string
    query: string
    getHeader: (name: string) => string
    getCookie: (name: string) => string
  }
  export type Match =
    & (
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
    )
    & {
      force404?: boolean
      conditions: Record<string, string>
      exceptions: Record<string, string>
    }
  export interface RedirectMatcher {
    match(req: Request): Match | null
  }
  export function parsePlain(rules: string, options: Options): Promise<RedirectMatcher>
  export function parseJSON(rules: string, options: Options): Promise<RedirectMatcher>
}
