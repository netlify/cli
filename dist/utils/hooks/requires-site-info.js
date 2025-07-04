import { logAndThrowError, warn } from '../command-helpers.js';
/**
 * A preAction hook that errors out if siteInfo is an empty object
 */
const requiresSiteInfo = async (command) => {
    // commander (at least the version we're on) is typed such that `.preAction()` can't accept
    // a subclass of `Command`. This type assertion avoids a lot of type noise in every call site.
    const { api, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        warn('Did you run `netlify link` yet?');
        return logAndThrowError(`You don't appear to be in a folder that is linked to a project`);
    }
    try {
        await api.getSite({ siteId });
    }
    catch (error_) {
        // unauthorized
        if (error_.status === 401) {
            warn(`Log in with a different account or re-link to a project you have permission for`);
            return logAndThrowError(`Not authorized to view the currently linked project (${siteId})`);
        }
        // missing
        if (error_.status === 404) {
            return logAndThrowError(`The project this folder is linked to can't be found`);
        }
        return logAndThrowError(error_);
    }
};
export default requiresSiteInfo;
//# sourceMappingURL=requires-site-info.js.map