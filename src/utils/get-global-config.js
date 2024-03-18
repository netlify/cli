import { readFile } from 'fs/promises';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'conf... Remove this comment to see the full error message
import Configstore from 'configstore';
import { v4 as uuidv4 } from 'uuid';
import { getLegacyPathInHome, getPathInHome } from '../lib/settings.js';
const globalConfigDefaults = {
    /* disable stats from being sent to Netlify */
    telemetryDisabled: false,
    /* cliId */
    cliId: uuidv4(),
};
// Memoise config result so that we only load it once
// @ts-expect-error TS(7034) FIXME: Variable 'configStore' implicitly has type 'any' i... Remove this comment to see the full error message
let configStore;
/**
 * @returns {Promise<Configstore>}
 */
const getGlobalConfig = async function () {
    // @ts-expect-error TS(7005) FIXME: Variable 'configStore' implicitly has an 'any' typ... Remove this comment to see the full error message
    if (!configStore) {
        const configPath = getPathInHome(['config.json']);
        // Legacy config file in home ~/.netlify/config.json
        const legacyPath = getLegacyPathInHome(['config.json']);
        let legacyConfig;
        // Read legacy config if exists
        try {
            // @ts-expect-error TS(2345) FIXME: Argument of type 'Buffer' is not assignable to par... Remove this comment to see the full error message
            legacyConfig = JSON.parse(await readFile(legacyPath));
        }
        catch { }
        // Use legacy config as default values
        const defaults = { ...globalConfigDefaults, ...legacyConfig };
        configStore = new Configstore(null, defaults, { configPath });
    }
    return configStore;
};
export const resetConfigCache = () => {
    configStore = undefined;
};
export default getGlobalConfig;
