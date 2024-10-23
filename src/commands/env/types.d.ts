import type { EnvironmentVariableScope } from '../../types.d.ts'
import type { ExtendedNetlifyAPI, Context } from '../api-types.d.ts'


export interface UnsetInEnvelopeParams {
  api: ExtendedNetlifyAPI
  context: Context[]
  key: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  siteInfo: any
}


export interface SetInEnvelopeParams extends UnsetInEnvelopeParams {
  value: string,
  scope: EnvironmentVariableScope[],
  secret: boolean, 
}

export interface SafeGetSite {
  api: ExtendedNetlifyAPI
  siteId: string
}
\