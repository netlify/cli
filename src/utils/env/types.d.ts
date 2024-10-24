import { Context, Scope } from "../../types.d.ts"
import { EnviromentVariables } from "../../commands/types.js"
import { SiteInfo } from "../../commands/api-types.js"

export interface GetEnvelopeEnvParams {
  api: ExtendedNetlifyAPI,
  context?: Context,
  env: EnvironmentVariables,
  key: string,
  scope: Scope,   
  raw?: boolean,
  siteInfo: SiteInfo
}

export type ProcessedEnvVars = {
  [key: string]: {
    context: string;
    branch?: string;
    scopes: string[];
    sources: string[];
    value: string;
  };
};