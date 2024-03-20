import { chalk, error, log, logJson } from '../../utils/command-helpers.js';
import { AVAILABLE_CONTEXTS, getEnvelopeEnv } from '../../utils/env/index.js';
export const envGet = async (name, options, command) => {
    const { context, scope } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No site id found, please run inside a site folder or `netlify link`');
        return false;
    }
    const { siteInfo } = cachedConfig;
    let { env } = cachedConfig;
    if (siteInfo.use_envelope) {
        env = await getEnvelopeEnv({ api, context, env, key: name, scope, siteInfo });
    }
    else if (context !== 'dev' || scope !== 'any') {
        error(`To specify a context or scope, please run ${chalk.yellow('netlify open:admin')} to open the Netlify UI and opt in to the new environment variables experience from Site settings`);
        return false;
    }
    const { value } = env[name] || {};
    // Return json response for piping commands
    if (options.json) {
        logJson(value ? { [name]: value } : {});
        return false;
    }
    if (!value) {
        const contextType = AVAILABLE_CONTEXTS.includes(context) ? 'context' : 'branch';
        const withContext = `in the ${chalk.magenta(context)} ${contextType}`;
        const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`;
        log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`);
        return false;
    }
    log(value);
};
