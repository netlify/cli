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
  slug?: string;
  scopes?: {
    all?: boolean;
    site?: ('read' | 'write')[];
    env?: ('read' | 'write' | 'delete')[];
    user?: ('read' | 'write')[];
  };
  integrationLevel?: 'site' | 'team' | 'team-and-site';
}


export interface registeredIntegration {
    slug: string
    name: string
    description: string
    integrationLevel: 'site' | 'team' | 'team-and-site';
    scopes: string
  }