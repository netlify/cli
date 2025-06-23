import { logAndThrowError } from '../command-helpers.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'addonName' implicitly has an 'any... Remove this comment to see the full error message
export const getCurrentAddon = ({ addonName, addons }) => addons.find((addon) => addon.service_slug === addonName);
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
export const getSiteData = async ({ api, siteId }) => {
    let siteData;
    try {
        siteData = await api.getSite({ siteId });
    }
    catch (error_) {
        return logAndThrowError(`Failed getting list of project data: ${error_.message}`);
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
        return logAndThrowError(`Failed getting list of addons: ${error_.message}`);
    }
    return addons;
};
//# sourceMappingURL=prepare.js.map