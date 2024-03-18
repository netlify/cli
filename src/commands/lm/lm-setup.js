import { Listr } from 'listr2';
import { error } from '../../utils/command-helpers.js';
import execa from '../../utils/execa.js';
import { installPlatform } from '../../utils/lm/install.js';
import { checkHelperVersion } from '../../utils/lm/requirements.js';
import { printBanner } from '../../utils/lm/ui.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'force' implicitly has an 'any' ty... Remove this comment to see the full error message
const installHelperIfMissing = async function ({ force }) {
    let installHelper = false;
    try {
        const version = await checkHelperVersion();
        if (!version) {
            installHelper = true;
        }
    }
    catch {
        installHelper = true;
    }
    if (installHelper) {
        return installPlatform({ force });
    }
    return false;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'siteId' implicitly has an 'any' type.
const provisionService = async function (siteId, api) {
    const addonName = 'large-media';
    if (!siteId) {
        throw new Error('No site id found, please run inside a site folder or `netlify link`');
    }
    try {
        await api.createServiceInstance({
            siteId,
            addon: addonName,
            body: {},
        });
    }
    catch (error_) {
        // error is JSONHTTPError
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        throw new Error(error_.json.error);
    }
};
// @ts-expect-error TS(7006) FIXME: Parameter 'siteId' implicitly has an 'any' type.
const configureLFSURL = async function (siteId, api) {
    const siteInfo = await api.getSite({ siteId });
    const url = `https://${siteInfo.id_domain}/.netlify/large-media`;
    return execa('git', ['config', '-f', '.lfsconfig', 'lfs.url', url]);
};
export const lmSetup = async (options, command) => {
    await command.authenticate();
    const { api, site } = command.netlify;
    let helperInstalled = false;
    if (!options.skipInstall) {
        try {
            helperInstalled = await installHelperIfMissing({ force: options.forceInstall });
        }
        catch (error_) {
            // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
            error(error_);
        }
    }
    const tasks = new Listr([
        {
            title: 'Provisioning Netlify Large Media',
            async task() {
                await provisionService(site.id, api);
            },
        },
        {
            title: 'Configuring Git LFS for this site',
            async task() {
                await configureLFSURL(site.id, api);
            },
        },
    ]);
    await tasks.run().catch(() => { });
    if (helperInstalled) {
        printBanner(options.forceInstall);
    }
};
