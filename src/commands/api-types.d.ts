import type { NetlifyAPI } from 'netlify'

import { Context } from './types.d.ts'

type ApiContext = Context | 'branch'

// Define the structure for the 'updated_by' field
interface UpdatedBy {
  // Add specific properties here if known
  // For now, we'll keep it generic
  id: string;
  full_name: string;
  email: string;
  avatar_url: string;
}

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
  key: string,
  siteId?: string,
  body: EnvVar[]
}

// Top-Level Interface
interface SiteData {
  id: string;
  state: string;
  plan: string;
  name: string;
  custom_domain: string;
  domain_aliases: string[];
  branch_deploy_custom_domain: string;
  deploy_preview_custom_domain: string;
  password: string;
  notification_email: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  screenshot_url: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  session_id: string;
  ssl: boolean;
  force_ssl: boolean;
  managed_dns: boolean;
  deploy_url: string;
  published_deploy: PublishedDeploy;
  account_id: string;
  account_name: string;
  account_slug: string;
  git_provider: string;
  deploy_hook: string;
  capabilities: Capabilities;
  processing_settings: ProcessingSettings;
  build_settings: BuildSettings;
  id_domain: string;
  default_hooks_data: DefaultHooksData;
  build_image: string;
  prerender: string;
  functions_region: string;
}

// Published Deploy Interface
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
  review_id: number;
  draft: boolean;
  required: string[];
  required_functions: string[];
  error_message: string;
  branch: string;
  commit_ref: string;
  commit_url: string;
  skipped: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  title: string;
  context: string;
  locked: boolean;
  review_url: string;
  framework: string;
  function_schedules: FunctionSchedule[];
}

// Function Schedule Interface
interface FunctionSchedule {
  name: string;
  cron: string;
}

// Capabilities Interface
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

// Build Settings Interface
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

// Environment Variables Interface
interface EnvVariables {
  [key: string]: string;
}

// Default Hooks Data Interface
interface DefaultHooksData {
  access_token: string;
}

  
export interface ExtendedNetlifyAPI extends NetlifyAPI {
  getEnvVars( params: GetEnvParams): Promise<EnvVar[]>
  deleteEnvVarValue( params: DeleteEnvVarValueParams  ): Promise<void>
  setEnvVarValue( params: SetEnvVarValueParams): Promise<EnvVar>
  deleteEnvVar(params: DeleteEnvVarValueParams): Promise<void>
  updateEnvVar(params: UpdateEnvVarParams): Promise<EnvVar>
  createEnvVars(params: createEnvVarParams): Promise<EnvVar[]>
  getSite({siteId: string}): Promise<SiteData> 
}