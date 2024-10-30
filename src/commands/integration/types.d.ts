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

interface IntegrationConfiguration {
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