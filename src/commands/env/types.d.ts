import type { ExtendedNetlifyAPI, Context } from '../types.d.ts'

export interface UnsetInEnvelope {
  api: ExtendedNetlifyAPI
  context: Context[]
  key: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  siteInfo: any
}
