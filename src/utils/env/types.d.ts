import { SiteInfo } from "../../types/api/api.js"
import {  Context, EnvironmentVariableSource, EnvironmentVariableScope } from "../../commands/types.js"

export interface GetEnvelopeEnvParams {
  api: ExtendedNetlifyAPI,
  context?: Context,
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