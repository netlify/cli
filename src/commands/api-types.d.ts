import type { NetlifyAPI } from 'netlify'

import { DeployContext } from './types.d.ts'

type ApiContext = DeployContext | 'branch'

interface UpdatedBy {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

export type NarrowedEnvVarValue = Pick<EnvVarValue, 'value' | 'context' | 'context_parameter'>

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

interface GetEnvParams {
  accountId: string,
  siteId?: string,
  context?: DeployContext,
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

interface CreateEnvVarParams {
  accountId: string,
  key?: string,
  siteId?: string,
  body: EnvVar[]
}

interface SiteInfo {
  id: string;
  state: string;
  plan: string;
  name: string;
  custom_domain: string | null;
  domain_aliases: string[];
  branch_deploy_custom_domain: string | null;
  deploy_preview_custom_domain: string | null;
  password: string | null;
  notification_email: string | null;
  url: string;
  ssl_url: string;
  admin_url: string;
  screenshot_url: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  session_id: string;
  ssl: boolean;
  force_ssl: boolean | null;
  managed_dns: boolean;
  deploy_url: string;
  published_deploy: PublishedDeploy;
  account_id: string;
  account_name: string;
  account_slug: string;
  git_provider?: string;
  deploy_hook: string;
  capabilities: Capabilities;
  processing_settings: ProcessingSettings;
  build_settings: BuildSettings;
  id_domain: string;
  default_hooks_data?: DefaultHooksData;
  build_image: string;
  prerender: string | null;
  functions_region: string;
  feature_flags: FeatureFlags;
}

interface PublishedDeploy {
  id: string;
  site_id: string;
  user_id: string;
  build_id: string;
  state: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  screenshot_url: string;
  review_id: number | null;
  draft: boolean;
  required: string[];
  required_functions: string[];
  error_message: string;
  branch: string;
  commit_ref: string;
  commit_url: string;
  skipped: boolean | null;
  created_at: string;
  updated_at: string;
  published_at: string;
  title: string;
  context: string;
  locked: boolean | null;
  review_url: string | null;
  framework: string;
  function_schedules: FunctionSchedule[] | [];
}

interface FunctionSchedule {
  name: string;
  cron: string;
}

interface Capabilities {
  [key: string]: Record<string, unknown>;
}

// Processing Settings Interface
interface ProcessingSettings {
  html: HTMLProcessingSettings;
}

// HTML Processing Settings Interface
interface HTMLProcessingSettings {
  pretty_urls: boolean;
}

interface BuildSettings {
  id: number;
  provider: string;
  deploy_key_id: string;
  repo_path: string;
  repo_branch: string;
  dir: string;
  functions_dir: string;
  cmd: string;
  allowed_branches: string[];
  public_repo: boolean;
  private_logs: boolean;
  repo_url: string;
  env: EnvVariables;
  installation_id: number;
  stop_builds: boolean;
}

interface EnvVariables {
  [key: string]: string;
}

interface DefaultHooksData {
  access_token: string;
} 

interface GetSiteParams {
  siteId?: string,
  feature_flags?: string
  site_id?: string
}

export interface ExtendedNetlifyAPI extends NetlifyAPI {
  getEnvVar(params: GetEnvVarParams): Promise<EnvVar>
  getEnvVars( params: GetEnvParams): Promise<EnvVar[]>
  deleteEnvVarValue( params: DeleteEnvVarValueParams  ): Promise<void>
  setEnvVarValue( params: SetEnvVarValueParams): Promise<EnvVar>
  deleteEnvVar(params: DeleteEnvVarValueParams): Promise<void>
  updateEnvVar(params: UpdateEnvVarParams): Promise<EnvVar>
  createEnvVars(params: CreateEnvVarParams): Promise<EnvVar[]>
  getSite(params: GetSiteParams): Promise<SiteInfo> 
}