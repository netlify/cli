import { SiteInfo } from "../../commands/api-types.js"
import {  DeployContext, EnvironmentVariableSource, EnvironmentVariableScope } from "../../commands/types.js"

export interface GetEnvelopeEnvParams {
  api: ExtendedNetlifyAPI,
  context?: DeployContext,
  env: EnvironmentVariables,
  key?: string,
  scope?: EnvironmentVariableScope | 'any'
  raw?: boolean,
  siteInfo: SiteInfo
}

export type ProcessedEnvVars = {
  [key: string]: {
    context: string;
    branch?: string;
    scopes: EnvironmentVariableScope[];
    sources: EnvironmentVariableSource[];
    value: string;
  };
};