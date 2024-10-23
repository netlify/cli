import type { NetlifyAPI } from 'netlify'

// Define the structure for the 'updated_by' field
interface UpdatedBy {
  // Add specific properties here if known
  // For now, we'll keep it generic
  [key: string]: any;
}

// Define the structure for each item in the array

interface EnvVarValue {
  id: string,
  value: string,
  context: string,
  context_parameter: string
}

export interface EnvVar {
  key: string;
  scopes: string[];
  values: EnvVarValue[];
  is_secret: boolean;
  updated_at?: string; 
  updated_by?: UpdatedBy;
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


interface UpdateEnvVarParams {
  accountId: string,
  key: string,
  siteId?: string
  body: EnvVar
}
  
export interface ExtendedNetlifyAPI extends NetlifyAPI {
  getEnvVars( params: GetEnvParams): Promise<EnvVar[]>
  deleteEnvVarValue( params: DeleteEnvVarValueParams  ): Promise<void>
  setEnvVarValue( params: SetEnvVarValueParams): Promise<EnvVar>
  deleteEnvVar(params: DeleteEnvVarValueParams): Promise<void>
  updateEnvVar(params: UpdateEnvVarParams): Promise<EnvVar>
}