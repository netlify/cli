import { readFile } from 'fs/promises';
import AsciiTable from 'ascii-table';
import dotenv from 'dotenv';
import { exit, log, logJson } from '../../utils/command-helpers.js';
import { translateFromEnvelopeToMongo, translateFromMongoToEnvelope } from '../../utils/env/index.js';
/**
 * Saves the imported env in the Envelope service
 * @returns {Promise<object>}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const importDotEnv = async ({ api, importedEnv, options, siteInfo }) => {
    // fetch env vars
    const accountId = siteInfo.account_slug;
    const siteId = siteInfo.id;
    const dotEnvKeys = Object.keys(importedEnv);
    const envelopeVariables = await api.getEnvVars({ accountId, siteId });
    // @ts-expect-error TS(7031) FIXME: Binding element 'key' implicitly has an 'any' type... Remove this comment to see the full error message
    const envelopeKeys = envelopeVariables.map(({ key }) => key);
    // if user intends to replace all existing env vars
    // either replace; delete all existing env vars on the site
    // or, merge; delete only the existing env vars that would collide with new .env entries
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    const keysToDelete = options.replaceExisting ? envelopeKeys : envelopeKeys.filter((key) => dotEnvKeys.includes(key));
    // delete marked env vars in parallel
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    await Promise.all(keysToDelete.map((key) => api.deleteEnvVar({ accountId, siteId, key })));
    // hit create endpoint
    const body = translateFromMongoToEnvelope(importedEnv);
    try {
        await api.createEnvVars({ accountId, siteId, body });
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        throw error.json ? error.json.msg : error;
    }
    // return final env to aid in --json output (for testing)
    return {
        // @ts-expect-error TS(7031) FIXME: Binding element 'key' implicitly has an 'any' type... Remove this comment to see the full error message
        ...translateFromEnvelopeToMongo(envelopeVariables.filter(({ key }) => !keysToDelete.includes(key))),
        ...importedEnv,
    };
};
export const envImport = async (fileName, options, command) => {
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No project id found, please run inside a project folder or `netlify link`');
        return false;
    }
    let importedEnv = {};
    try {
        const envFileContents = await readFile(fileName, 'utf-8');
        importedEnv = dotenv.parse(envFileContents);
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        log(error.message);
        exit(1);
    }
    if (Object.keys(importedEnv).length === 0) {
        log(`No environment variables found in file ${fileName} to import`);
        return false;
    }
    const { siteInfo } = cachedConfig;
    const finalEnv = await importDotEnv({ api, importedEnv, options, siteInfo });
    // Return new environment variables of site if using json flag
    if (options.json) {
        logJson(finalEnv);
        return false;
    }
    // List newly imported environment variables in a table
    log(`site: ${siteInfo.name}`);
    const table = new AsciiTable(`Imported environment variables`);
    table.setHeading('Key', 'Value');
    table.addRowMatrix(Object.entries(importedEnv));
    log(table.toString());
};
//# sourceMappingURL=env-import.js.map