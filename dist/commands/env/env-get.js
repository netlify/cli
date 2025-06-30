import { chalk, log, logJson } from '../../utils/command-helpers.js';
import { SUPPORTED_CONTEXTS, getEnvelopeEnv } from '../../utils/env/index.js';
export const envGet = async (name, options, command) => {
    const { context, scope } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No project id found, please run inside a project folder or `netlify link`');
        return false;
    }
    const { siteInfo } = cachedConfig;
    const env = await getEnvelopeEnv({ api, context, env: cachedConfig.env, key: name, scope, siteInfo });
    // @ts-expect-error FIXME(ndhoule)
    const { value } = env[name] || {};
    // Return json response for piping commands
    if (options.json) {
        logJson(value ? { [name]: value } : {});
        return false;
    }
    if (!value) {
        const contextType = SUPPORTED_CONTEXTS.includes(context) ? 'context' : 'branch';
        const withContext = `in the ${chalk.magenta(context)} ${contextType}`;
        const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`;
        log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`);
        return false;
    }
    log(value);
};
//# sourceMappingURL=env-get.js.map