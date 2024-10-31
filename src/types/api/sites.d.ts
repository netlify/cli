import type { $TSFixMe } from '../types.js'

interface GetSiteParams {
  siteId?: string,
  feature_flags?: string
  site_id?: string
}

interface CreateSiteInTeamParams {
  accountSlug?: string,
  body: SiteRequestBody | {name?: string}
}

interface ListSitesParams {
  name?: string,
  filter?: "all" | "owner" | "guest",
  page?: number,
  per_page?: number,
}

interface CommonSiteProperties {
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
  available_functions: $TSFixMe[];
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
  env?: EnvVariables;
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
  

interface SiteRequestBody extends CommonSiteProperties {
  repo: {
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
    env: {
      [key: string]: string;
    };
    installation_id: number;
    stop_builds: boolean;
  };
}

// Response object for API calls that return site information
export interface SiteInfo extends CommonSiteProperties {
  functions_config?: {
    timeout: Number
  };
  functions_timeout?: Number;
  feature_flags: FeatureFlags;
  dev_server_settings?: DevServerSettings;

}

interface DevServerSettings {
  cmd: string;
  target_port: number;
}

