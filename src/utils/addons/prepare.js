import { chalk, error, exit, log, warn } from '../command-helpers.js';
export const ADDON_VALIDATION = {
    EXISTS: 'EXISTS',
    NOT_EXISTS: 'NOT_EXISTS',
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addon' implicitly has an 'any' ty... Remove this comment to see the full error message
const validateExists = ({ addon, addonName, siteData }) => {
    if (!addon || !addon.id) {
        log(`Add-on ${addonName} doesn't exist for ${siteData.name}`);
        log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`);
        exit(1);
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addon' implicitly has an 'any' ty... Remove this comment to see the full error message
const validateNotExists = ({ addon, addonName, siteData }) => {
    if (addon && addon.id) {
        log(`The "${addonName} add-on" already exists for ${siteData.name}`);
        log();
        const cmd = chalk.cyan(`\`netlify addons:config ${addonName}\``);
        log(`- To update this add-on run: ${cmd}`);
        const deleteCmd = chalk.cyan(`\`netlify addons:delete ${addonName}\``);
        log(`- To remove this add-on run: ${deleteCmd}`);
        log();
        exit(1);
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addonName' implicitly has an 'any... Remove this comment to see the full error message
export const getCurrentAddon = ({ addonName, addons }) => addons.find((addon) => addon.service_slug === addonName);
// @ts-expect-error TS(7031) FIXME: Binding element 'addon' implicitly has an 'any' ty... Remove this comment to see the full error message
const validateCurrentAddon = ({ addon, addonName, siteData, validation }) => {
    switch (validation) {
        case ADDON_VALIDATION.EXISTS: {
            validateExists({ addon, addonName, siteData });
            break;
        }
        case ADDON_VALIDATION.NOT_EXISTS: {
            validateNotExists({ addon, addonName, siteData });
            break;
        }
        default: {
            warn(`Unknown addons validation: ${validation}`);
            break;
        }
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addonName' implicitly has an 'any... Remove this comment to see the full error message
export const getAddonManifest = async ({ addonName, api }) => {
    let manifest;
    try {
        manifest = await api.showServiceManifest({ addonName });
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (typeof error_.message === 'string' && error_.message.includes('Not Found')) {
            error(`No add-on "${addonName}" found. Please double check your add-on name and try again`);
        }
        else {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            error(error_.message);
        }
    }
    return manifest;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
export const getSiteData = async ({ api, siteId }) => {
    let siteData;
    try {
        siteData = await api.getSite({ siteId });
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        error(`Failed getting list of site data: ${error_.message}`);
    }
    return siteData;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
export const getAddons = async ({ api, siteId }) => {
    let addons;
    try {
        addons = await api.listServiceInstancesForSite({ siteId });
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        error(`Failed getting list of addons: ${error_.message}`);
    }
    return addons;
};
/**
 *
 * @param {object} config
 * @param {import('../../commands/base-command.js').default} config.command
 * @param {string} [config.addonName]
 * @param {keyof ADDON_VALIDATION} [config.validation]
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'addonName' implicitly has an 'any... Remove this comment to see the full error message
export const prepareAddonCommand = async ({ addonName, command, validation }) => {
    const { netlify } = command;
    const { api, site } = netlify;
    const siteId = site.id;
    if (!siteId) {
        error('No site id found, please run inside a site folder or `netlify link`');
    }
    await command.authenticate();
    const [manifest, siteData, addons] = await Promise.all([
        // TODO: check as `getAddonManifest` did not accept a parameter error
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ api: any; addonName: any; erro... Remove this comment to see the full error message
        addonName ? getAddonManifest({ api, addonName, error }) : Promise.resolve(),
        getSiteData({ api, siteId }),
        getAddons({ api, siteId }),
    ]);
    let addon;
    if (addonName) {
        addon = getCurrentAddon({ addons, addonName });
        validateCurrentAddon({ addon, validation, addonName, siteData });
    }
    return { manifest, addons, addon, siteData };
};
