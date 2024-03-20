import { error, warn } from '../command-helpers.js';
/**
 * A preAction hook that errors out if siteInfo is an empty object
 * @param {*} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const requiresSiteInfo = async (command) => {
    const { api, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        warn('Did you run `netlify link` yet?');
        return error(`You don't appear to be in a folder that is linked to a site`);
    }
    try {
        await api.getSite({ siteId });
    }
    catch (error_) {
        // unauthorized
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.status === 401) {
            warn(`Log in with a different account or re-link to a site you have permission for`);
            return error(`Not authorized to view the currently linked site (${siteId})`);
        }
        // missing
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.status === 404) {
            return error(`The site this folder is linked to can't be found`);
        }
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        return error(error_);
    }
};
export default requiresSiteInfo;
