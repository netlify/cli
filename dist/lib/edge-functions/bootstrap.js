import { env } from 'process';
import { getURL } from '@netlify/edge-functions/version';
import { warn } from '../../utils/command-helpers.js';
export const FALLBACK_BOOTSTRAP_URL = 'https://edge.netlify.com/bootstrap/index-combined.ts';
export const getBootstrapURL = async () => {
    if (env.NETLIFY_EDGE_BOOTSTRAP) {
        return env.NETLIFY_EDGE_BOOTSTRAP;
    }
    try {
        return await getURL();
    }
    catch (error) {
        warn(`Could not load latest version of Edge Functions environment: ${error?.message ?? ''}`);
        // If there was an error getting the bootstrap URL from the module, let's
        // use the latest version of the bootstrap. This is not ideal, but better
        // than failing to serve requests with edge functions.
        return FALLBACK_BOOTSTRAP_URL;
    }
};
//# sourceMappingURL=bootstrap.js.map