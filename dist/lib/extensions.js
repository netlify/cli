import isEmpty from 'lodash/isEmpty.js';
export const packagesThatNeedSites = new Set(['@netlify/neon']);
export const doesProjectRequireLinkedSite = async ({ options, project, site, siteInfo, }) => {
    // If we don't have a site, these extensions need one initialized
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const hasSiteData = Boolean(site.id || options.site) && !isEmpty(siteInfo);
    if (hasSiteData) {
        return [false, []];
    }
    const packageJson = await project.getPackageJSON();
    const dependencies = packageJson.dependencies ?? {};
    const packageNames = Object.keys(dependencies).filter((packageName) => packagesThatNeedSites.has(packageName));
    return [packageNames.length > 0, packageNames];
};
//# sourceMappingURL=extensions.js.map