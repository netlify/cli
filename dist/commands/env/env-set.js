import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js';
import { SUPPORTED_CONTEXTS, ALL_ENVELOPE_SCOPES, translateFromEnvelopeToMongo } from '../../utils/env/index.js';
import { promptOverwriteEnvVariable } from '../../utils/prompts/env-set-prompts.js';
/**
 * Updates the env for a site configured with Envelope with a new key/value pair
 * @returns {Promise<object | boolean>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const setInEnvelope = async ({ api, context, force, key, scope, secret, siteInfo, value }) => {
    const accountId = siteInfo.account_slug;
    const siteId = siteInfo.id;
    // secret values may not be used in the post-processing scope
    // @ts-expect-error TS(7006) FIXME: Parameter 'sco' implicitly has an 'any' type.
    if (secret && scope?.some((sco) => /post[-_]processing/.test(sco))) {
        return logAndThrowError(`Secret values cannot be used within the post-processing scope.`);
    }
    // secret values must specify deploy contexts. `all` or `dev` are not allowed
    if (secret && value && (!context || context.includes('dev'))) {
        return logAndThrowError(`To set a secret environment variable value, please specify a non-development context with the \`--context\` flag.`);
    }
    // fetch envelope env vars
    const envelopeVariables = await api.getEnvVars({ accountId, siteId });
    const contexts = context || ['all'];
    let scopes = scope || ALL_ENVELOPE_SCOPES;
    if (secret) {
        // post_processing (aka post-processing) scope is not allowed with secrets
        // @ts-expect-error TS(7006) FIXME: Parameter 'sco' implicitly has an 'any' type.
        scopes = scopes.filter((sco) => !/post[-_]processing/.test(sco));
    }
    // if the passed context is unknown, it is actually a branch name
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    let values = contexts.map((ctx) => SUPPORTED_CONTEXTS.includes(ctx) ? { context: ctx, value } : { context: 'branch', context_parameter: ctx, value });
    // @ts-expect-error TS(7006) FIXME: Parameter 'envVar' implicitly has an 'any' type.
    const existing = envelopeVariables.find((envVar) => envVar.key === key);
    // Checks if --force is passed and if it is an existing variaible, then we need to prompt the user
    if (Boolean(force) === false && existing) {
        await promptOverwriteEnvVariable(key);
    }
    const params = { accountId, siteId, key };
    try {
        if (existing) {
            if (!value) {
                values = existing.values;
                if (!scope) {
                    scopes = existing.scopes;
                }
            }
            if (context && scope) {
                return logAndThrowError('Setting the context and scope at the same time on an existing env var is not allowed. Run the set command separately for each update.');
            }
            if (context) {
                // update individual value(s)
                // @ts-expect-error TS(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                await Promise.all(values.map((val) => api.setEnvVarValue({ ...params, body: val })));
            }
            else {
                // otherwise update whole env var
                if (secret) {
                    // @ts-expect-error TS(7006) FIXME: Parameter 'sco' implicitly has an 'any' type.
                    scopes = scopes.filter((sco) => !/post[-_]processing/.test(sco));
                    // @ts-expect-error TS(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                    if (values.some((val) => val.context === 'all')) {
                        log(`This secret's value will be empty in the dev context.`);
                        log(`Run \`netlify env:set ${key} <value> --context dev\` to set a new value for the dev context.`);
                        values = SUPPORTED_CONTEXTS.filter((ctx) => ctx !== 'all').map((ctx) => ({
                            context: ctx,
                            // empty out dev value so that secret is indeed secret
                            // @ts-expect-error TS(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
                            value: ctx === 'dev' ? '' : values.find((val) => val.context === 'all').value,
                        }));
                    }
                }
                const body = { key, is_secret: secret, scopes, values };
                await api.updateEnvVar({ ...params, body });
            }
        }
        else {
            // create whole env var
            const body = [{ key, is_secret: secret, scopes, values }];
            await api.createEnvVars({ ...params, body });
        }
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        throw error_.json ? error_.json.msg : error_;
    }
    const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev');
    return {
        ...env,
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        [key]: value || env[key],
    };
};
export const envSet = async (key, value, options, command) => {
    const { context, force, scope, secret } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No project id found, please run inside a project folder or `netlify link`');
        return false;
    }
    const { siteInfo } = cachedConfig;
    // Get current environment variables set in the UI
    const finalEnv = await setInEnvelope({ api, siteInfo, force, key, value, context, scope, secret });
    if (!finalEnv) {
        return false;
    }
    // Return new environment variables of site if using json flag
    if (options.json) {
        logJson(finalEnv);
        return false;
    }
    const withScope = scope ? ` scoped to ${chalk.white(scope)}` : '';
    const withSecret = secret ? ` as a ${chalk.blue('secret')}` : '';
    const contextType = SUPPORTED_CONTEXTS.includes(context || 'all') ? 'context' : 'branch';
    log(`Set environment variable ${chalk.yellow(`${key}${value && !secret ? `=${value}` : ''}`)}${withScope}${withSecret} in the ${chalk.magenta(context || 'all')} ${contextType}`);
};
//# sourceMappingURL=env-set.js.map