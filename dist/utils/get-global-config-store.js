import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import * as dot from 'dot-prop';
import { v4 as uuidv4 } from 'uuid';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { getLegacyPathInHome, getPathInHome } from '../lib/settings.js';
export class GlobalConfigStore {
    #storagePath;
    constructor(options = {}) {
        this.#storagePath = getPathInHome(['config.json']);
        if (options.defaults) {
            const config = this.getConfig();
            this.writeConfig({ ...options.defaults, ...config });
        }
    }
    get all() {
        return this.getConfig();
    }
    set(key, value) {
        const config = this.getConfig();
        const updatedConfig = dot.setProperty(config, key, value);
        this.writeConfig(updatedConfig);
    }
    get(key) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return dot.getProperty(this.getConfig(), key);
    }
    getConfig() {
        let raw;
        try {
            raw = fss.readFileSync(this.#storagePath, 'utf8');
        }
        catch (err) {
            if (err instanceof Error && 'code' in err) {
                if (err.code === 'ENOENT') {
                    // File or parent directory does not exist
                    return {};
                }
            }
            throw err;
        }
        try {
            return JSON.parse(raw);
        }
        catch {
            writeFileAtomicSync(this.#storagePath, '', { mode: 0o0600 });
            return {};
        }
    }
    writeConfig(value) {
        fss.mkdirSync(path.dirname(this.#storagePath), { mode: 0o0700, recursive: true });
        writeFileAtomicSync(this.#storagePath, JSON.stringify(value, undefined, '\t'), { mode: 0o0600 });
    }
}
const globalConfigDefaults = {
    /* disable stats from being sent to Netlify */
    telemetryDisabled: false,
    /* cliId */
    cliId: uuidv4(),
};
// Memoise config result so that we only load it once
let configStore;
const getGlobalConfigStore = async () => {
    if (!configStore) {
        // Legacy config file in home ~/.netlify/config.json
        const legacyPath = getLegacyPathInHome(['config.json']);
        // Read legacy config if exists
        let legacyConfig;
        try {
            legacyConfig = JSON.parse(await fs.readFile(legacyPath, 'utf8'));
        }
        catch {
            // ignore error
        }
        // Use legacy config as default values
        const defaults = { ...globalConfigDefaults, ...legacyConfig };
        // The id param is only used when not passing `configPath` but the type def requires it
        configStore = new GlobalConfigStore({ defaults });
    }
    return configStore;
};
export default getGlobalConfigStore;
export const resetConfigCache = () => {
    configStore = undefined;
};
//# sourceMappingURL=get-global-config-store.js.map