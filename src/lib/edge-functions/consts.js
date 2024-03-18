export const DIST_IMPORT_MAP_PATH = 'edge-functions-import-map.json';
export const INTERNAL_EDGE_FUNCTIONS_FOLDER = 'edge-functions';
export const EDGE_FUNCTIONS_FOLDER = 'edge-functions-dist';
export const EDGE_FUNCTIONS_SERVE_FOLDER = 'edge-functions-serve';
export const PUBLIC_URL_PATH = '.netlify/internal/edge-functions';
// Feature flags related to Edge Functions that should be passed along to
// Netlify Build.
export const featureFlags = {
    edge_functions_config_export: true,
    edge_functions_npm_modules: true,
    edge_functions_read_deno_config: true,
};
