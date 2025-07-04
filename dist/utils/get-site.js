import { logAndThrowError } from './command-helpers.js';
export const getSiteByName = async (api, siteName) => {
    try {
        const sites = await api.listSites({ name: siteName, filter: 'all' });
        const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName);
        if (!siteFoundByName) {
            throw new Error(`Project "${siteName}" cannot be found`);
        }
        // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
        return siteFoundByName;
    }
    catch (error_) {
        if (error_.status === 401) {
            return logAndThrowError(`${error_.message}: could not retrieve project`);
        }
        else {
            return logAndThrowError('Project not found. Please rerun "netlify link"');
        }
    }
};
//# sourceMappingURL=get-site.js.map