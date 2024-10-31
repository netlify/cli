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

export interface IntegrationConfiguration {
  name?: string;
  description?: string;
  slug: string;
  scopes?: ScopePermissions
  integrationLevel?: 'site' | 'team' | 'team-and-site';
}


export interface RegisteredIntegration {
    slug: string
    name: string
    description: string
    integrationLevel: 'site' | 'team' | 'team-and-site';
    scopes: string
  }

export interface ScopePermissions {
  all?: boolean;
  site?: ('read' | 'write')[];
  env?: ('read' | 'write' | 'delete')[];
  user?: ('read' | 'write')[];
};

export type RegisteredIntegrationScopes = 'site:read' | 'site:write' | 'env:read' | 'env:write' | 'env:delete' | 'user:read' | 'user:write' 

export type LocalTypeScope = RegisteredIntegrationScopes | 'all'