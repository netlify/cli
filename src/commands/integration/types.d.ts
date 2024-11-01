import { tokenTuple } from "../../utils/command-helpers.ts"

export interface IntergrationOptions extends OptionValues {
  context: Context
  cwd: string
  debug: boolean
  dry: boolean
  json: boolean
  offline: boolean
  silent: boolean
  prod?: boolean
}
export type IntegrationLevel = 'site' | 'team' | 'team-and-site';
export interface IntegrationConfiguration {
  name?: string;
  description?: string;
  slug: string;
  scopes?: ScopePermissions
  integrationLevel?: IntegrationLevel;
}


export interface RegisteredIntegration {
    slug: string
    name: string
    description: string
    integrationLevel: IntegrationLevel;
    scopes: string
  }

export type ScopeResource = 'site' | 'env' | 'user';
export type ScopePermission = 'read' | 'write' | 'delete';

export interface ScopePermissions {
  all?: boolean;
  site?: Array<Exclude<ScopePermission, 'delete'>>;
  env?: ScopePermission[];
  user?: Array<Exclude<ScopePermission, 'delete'>>;
}

export type RegisteredIntegrationScopes = 
  | `site:${'read' | 'write'}`
  | `env:${'read' | 'write' | 'delete'}`
  | `user:${'read' | 'write'}`
  | 'all';

export type LocalTypeScope = RegisteredIntegrationScopes | 'all';

export interface IntegrationRegistrationResponse {
  slug: string;
  msg?: string;  
}

export interface ScopeWriter {
  all?: boolean;
  [key: string]:  ScopePermission[] | boolean;
}
