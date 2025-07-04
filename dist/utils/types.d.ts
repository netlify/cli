import type { Buffer } from 'buffer';
import type { IncomingMessage } from 'http';
import type { PollingStrategy } from '@netlify/build-info';
import type { Match } from 'netlify-redirector';
export type { GlobalConfigStore } from './get-global-config-store.js';
export { default as CLIState } from './cli-state.js';
export type FrameworkNames = '#static' | '#auto' | '#custom' | string;
export type FrameworkInfo = {
    build: {
        directory: string;
    };
    dev: {
        commands: string[];
        port: number;
        pollingStrategies: PollingStrategy[];
    };
    name: FrameworkNames;
    staticAssetsDirectory: string;
    env: NodeJS.ProcessEnv;
    plugins?: string[];
};
export type BaseServerSettings = {
    baseDirectory?: string;
    dist: string;
    /** The command that was provided for the dev config */
    command?: string;
    /** If it should be served like static files */
    useStaticServer?: boolean;
    /** A port where a proxy can listen to it */
    frameworkPort?: number;
    /** The host where a proxy can listen to it */
    frameworkHost?: '127.0.0.1' | '::1';
    /** Try both v4 and v6 IPs */
    detectFrameworkHost?: boolean;
    functions?: string;
    /** The framework name ('Create React App') */
    framework?: string;
    env?: NodeJS.ProcessEnv;
    pollingStrategies?: string[];
    plugins?: string[];
    clearPublishDirectory?: boolean;
};
export type ServerSettings = BaseServerSettings & {
    /** default 'secret' */
    jwtSecret: string;
    /** default 'app_metadata.authorization.roles' */
    jwtRolePath: string;
    /** The port where the dev server is running on */
    port: number;
    /** The port where the functions are running on */
    functionsPort: number;
    https?: {
        key: string;
        cert: string;
        keyFilePath: string;
        certFilePath: string;
    };
    clearPublishDirectory?: boolean;
    skipWaitPort?: boolean;
};
export interface Request extends IncomingMessage {
    originalBody?: Buffer | null;
    protocol?: string;
    hostname?: string;
}
export type Rewriter = (req: Request) => Promise<Match | null>;
export interface SiteInfo {
    account_id?: string | undefined;
    account_name: string;
    account_slug: string;
    admin_url: string;
    build_settings?: {
        allowed_branches: string[];
        cmd: string;
        deploy_key_id: string;
        dir: string;
        env?: Record<string, unknown>;
        id: number;
        private_logs: boolean;
        provider: string;
        public_repo: boolean;
        repo_branch: string;
        repo_path: string;
        repo_url: string;
    } | undefined;
    capabilities: Record<string, unknown>;
    created_at: string;
    custom_domain: string;
    deploy_hook: string;
    deploy_url: string;
    dev_server_settings?: {
        cmd: string;
        target_port: number;
    } | undefined;
    domain_aliases: string[];
    feature_flags?: Record<string, string | boolean>;
    force_ssl: boolean;
    git_provider: string;
    id: string;
    managed_dns: boolean;
    name: string;
    notification_email: string;
    password: string;
    plan: string;
    processing_settings: {
        css: {
            bundle: boolean;
            minify: boolean;
        };
        html: Record<string, unknown>;
        images: Record<string, unknown>;
        js: {
            bundle: boolean;
            minify: boolean;
        };
        skip: boolean;
    };
    published_deploy: {
        admin_url: string;
        branch: string;
        build_id: string;
        commit_ref: string;
        commit_url: string;
        context: string;
        created_at: string;
        deploy_ssl_url: string;
        deploy_url: string;
        draft: boolean;
        error_message: string;
        id: string;
        locked: boolean;
        name: string;
        published_at: string;
        required: string[];
        required_functions: string[];
        review_id: number;
        review_url: string;
        screenshot_url: string;
        site_id: string;
        skipped: boolean;
        ssl_url: string;
        state: string;
        title: string;
        updated_at: string;
        url: string;
        user_id: string;
    } | undefined;
    screenshot_url: string;
    session_id: string;
    ssl: boolean;
    ssl_url: string;
    state: string;
    updated_at: string;
    url: string;
    user_id: string;
}
export type TokenLocation = 'env' | 'flag' | 'config' | 'not found';
export type EnvVar = {
    key: string;
    scopes: string[];
    values: EnvVarValue[];
    updated_at: string;
    is_secret: boolean;
};
type EnvVarValue = {
    id: string;
    context: string;
};
export type MinimalAccount = {
    id: string;
    name: string;
    slug: string;
    default: boolean;
    team_logo_url: string | null;
    on_pro_trial: boolean;
    organization_id: string | null;
    type_name: string;
    type_slug: string;
    members_count: number;
};
export interface GitHubRepo {
    name: string;
    html_url: string;
    full_name: string;
    archived: boolean;
    disabled: boolean;
}
export interface Template {
    name: string;
    sourceCodeUrl: string;
    slug: string;
}
type EnvironmentVariableScope = 'builds' | 'functions' | 'runtime' | 'post_processing';
export type EnvironmentVariableSource = 'account' | 'addons' | 'configFile' | 'general' | 'internal' | 'ui';
export type EnvironmentVariables = Record<string, {
    sources: EnvironmentVariableSource[];
    value: string;
    scopes?: EnvironmentVariableScope[];
}>;
export interface Plugin {
    origin?: string;
    package: string;
    pinned_version?: string | undefined;
}
//# sourceMappingURL=types.d.ts.map