import { chalk, error, log, logJson } from '../../utils/command-helpers.js';
import { AVAILABLE_CONTEXTS, AVAILABLE_SCOPES, translateFromEnvelopeToMongo } from '../../utils/env/index.js';
/**
 * Updates the env for a site record with a new key/value pair
 * @returns {Promise<object>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const setInMongo = async ({ api, key, siteInfo, value }) => {
    const { env = {} } = siteInfo.build_settings;
    const newEnv = {
        ...env,
        [key]: value,
    };
    // Apply environment variable updates
    await api.updateSite({
        siteId: siteInfo.id,
        body: {
            build_settings: {
                env: newEnv,
            },
        },
    });
    return newEnv;
};
/**
 * Updates the env for a site configured with Envelope with a new key/value pair
 * @returns {Promise<object | boolean>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const setInEnvelope = async ({ api, context, key, scope, secret, siteInfo, value }) => {
    const accountId = siteInfo.account_slug;
    const siteId = siteInfo.id;
    // secret values may not be used in the post-processing scope
    // @ts-expect-error TS(7006) FIXME: Parameter 'sco' implicitly has an 'any' type.
    if (secret && scope && scope.some((sco) => /post[-_]processing/.test(sco))) {
        error(`Secret values cannot be used within the post-processing scope.`);
        return false;
    }
    // secret values must specify deploy contexts. `all` or `dev` are not allowed
    if (secret && value && (!context || context.includes('dev'))) {
        error(`To set a secret environment variable value, please specify a non-development context with the \`--context\` flag.`);
        return false;
    }
    // fetch envelope env vars
    const envelopeVariables = await api.getEnvVars({ accountId, siteId });
    const contexts = context || ['all'];
    let scopes = scope || AVAILABLE_SCOPES;
    if (secret) {
        // post_processing (aka post-processing) scope is not allowed with secrets
        // @ts-expect-error TS(7006) FIXME: Parameter 'sco' implicitly has an 'any' type.
        scopes = scopes.filter((sco) => !/post[-_]processing/.test(sco));
    }
    // if the passed context is unknown, it is actually a branch name
    // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
    let values = contexts.map((ctx) => AVAILABLE_CONTEXTS.includes(ctx) ? { context: ctx, value } : { context: 'branch', context_parameter: ctx, value });
    // @ts-expect-error TS(7006) FIXME: Parameter 'envVar' implicitly has an 'any' type.
    const existing = envelopeVariables.find((envVar) => envVar.key === key);
    const params = { accountId, siteId, key };
    try {
        if (existing) {
            if (!value) {
                // eslint-disable-next-line prefer-destructuring
                values = existing.values;
                if (!scope) {
                    // eslint-disable-next-line prefer-destructuring
                    scopes = existing.scopes;
                }
            }
            if (context && scope) {
                error('Setting the context and scope at the same time on an existing env var is not allowed. Run the set command separately for each update.');
                return false;
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
                        values = AVAILABLE_CONTEXTS.filter((ctx) => ctx !== 'all').map((ctx) => ({
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
    const { context, scope, secret } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No site id found, please run inside a site folder or `netlify link`');
        return false;
    }
    const { siteInfo } = cachedConfig;
    let finalEnv;
    // Get current environment variables set in the UI
    if (siteInfo.use_envelope) {
        finalEnv = await setInEnvelope({ api, siteInfo, key, value, context, scope, secret });
    }
    else if (context || scope) {
        error(`To specify a context or scope, please run ${chalk.yellow('netlify open:admin')} to open the Netlify UI and opt in to the new environment variables experience from Site settings`);
        return false;
    }
    else {
        finalEnv = await setInMongo({ api, siteInfo, key, value });
    }
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
    const contextType = AVAILABLE_CONTEXTS.includes(context || 'all') ? 'context' : 'branch';
    log(`Set environment variable ${chalk.yellow(`${key}${value && !secret ? `=${value}` : ''}`)}${withScope}${withSecret} in the ${chalk.magenta(context || 'all')} ${contextType}`);
};
