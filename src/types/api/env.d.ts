import { Context } from './types.d.ts'

type ApiContext = Context | 'branch'

export type Value = Pick<EnvVarValue, 'value' | 'context' | 'context_parameter'>
// Define the structure for each item in the array

interface EnvVarValue {
  value: string,
  context: ApiContext,
  context_parameter?: string,
  id?: string,
} 

export interface EnvVar {
  key: string;
  scopes: Scope[];
  values: EnvVarValue[];
  is_secret?: boolean;
  updated_at?: string; 
  updated_by?: UpdatedBy;
}

interface UpdatedBy {
    // Add specific properties here if known
    // For now, we'll keep it generic
    id: string;
    full_name: string;
    email: string;
    avatar_url: string;
  }

interface GetEnvParams {
  accountId: string,
  siteId?: string,
  context?: Context,
  scope?: EnvironmentVariableScope
}

interface DeleteEnvVarValueParams {
  accountId: string,
  key: string,
  id?: string,
  siteId?: string 
}

interface SetEnvVarValueBody {
  context: string,
  value: string,
  contextParameter?: string,
}

interface SetEnvVarValueParams {
  accountId: string,
  key: string,
  siteId?: string,
  body: SetEnvVarValueBody
}

interface UpdateEnvVarBody {
  key: string,
  scopes: string[],
  values: EnvVar[]
  is_secret: boolean
}

interface UpdateEnvVarParams {
  accountId: string,
  key: string,
  siteId?: string
  body: EnvVar
}

interface createEnvVarParams {
  accountId: string,
  key?: string,
  siteId?: string,
  body: EnvVar[]
}