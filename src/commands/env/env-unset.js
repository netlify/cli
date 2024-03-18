import { chalk, error, log, logJson } from '../../utils/command-helpers.js';
import { AVAILABLE_CONTEXTS, translateFromEnvelopeToMongo } from '../../utils/env/index.js';
/**
 * Deletes a given key from the env of a site record
 * @returns {Promise<object>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const unsetInMongo = async ({ api, key, siteInfo }) => {
    // Get current environment variables set in the UI
    const { build_settings: { env = {} }, } = siteInfo;
    const newEnv = env;
    // Delete environment variable from current variables
    delete newEnv[key];
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
 * Deletes a given key from the env of a site configured with Envelope
 * @returns {Promise<object>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const unsetInEnvelope = async ({ api, context, key, siteInfo }) => {
    const accountId = siteInfo.account_slug;
    const siteId = siteInfo.id;
    // fetch envelope env vars
    const envelopeVariables = await api.getEnvVars({ accountId, siteId });
    const contexts = context || ['all'];
    const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev');
    // check if the given key exists
    // @ts-expect-error TS(7006) FIXME: Parameter 'envVar' implicitly has an 'any' type.
    const variable = envelopeVariables.find((envVar) => envVar.key === key);
    if (!variable) {
        // if not, no need to call delete; return early
        return env;
    }
    const params = { accountId, siteId, key };
    try {
        if (context) {
            // if context(s) are passed, delete the matching contexts / branches, and the `all` context
            // @ts-expect-error TS(7006) FIXME: Parameter 'val' implicitly has an 'any' type.
            const values = variable.values.filter((val) => [...contexts, 'all'].includes(val.context_parameter || val.context));
            if (values) {
                // @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.
                await Promise.all(values.map((value) => api.deleteEnvVarValue({ ...params, id: value.id })));
                // if this was the `all` context, we need to create 3 values in the other contexts
                if (values.length === 1 && values[0].context === 'all') {
                    const newContexts = AVAILABLE_CONTEXTS.filter((ctx) => !context.includes(ctx));
                    const allValue = values[0].value;
                    await Promise.all(newContexts
                        .filter((ctx) => ctx !== 'all')
                        .map((ctx) => api.setEnvVarValue({ ...params, body: { context: ctx, value: allValue } })));
                }
            }
        }
        else {
            // otherwise, if no context passed, delete the whole key
            await api.deleteEnvVar({ accountId, siteId, key });
        }
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        throw error_.json ? error_.json.msg : error_;
    }
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    delete env[key];
    return env;
};
export const envUnset = async (key, options, command) => {
    const { context } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No site id found, please run inside a site folder or `netlify link`');
        return false;
    }
    const { siteInfo } = cachedConfig;
    let finalEnv;
    if (siteInfo.use_envelope) {
        finalEnv = await unsetInEnvelope({ api, context, siteInfo, key });
    }
    else if (context) {
        error(`To specify a context, please run ${chalk.yellow('netlify open:admin')} to open the Netlify UI and opt in to the new environment variables experience from Site settings`);
        return false;
    }
    else {
        finalEnv = await unsetInMongo({ api, siteInfo, key });
    }
    // Return new environment variables of site if using json flag
    if (options.json) {
        logJson(finalEnv);
        return false;
    }
    const contextType = AVAILABLE_CONTEXTS.includes(context || 'all') ? 'context' : 'branch';
    log(`Unset environment variable ${chalk.yellow(key)} in the ${chalk.magenta(context || 'all')} ${contextType}`);
};
