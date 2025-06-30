import URL from 'url';
import fetch from 'node-fetch';
// supported repo host types
const GITHUB = 'GitHub';
/**
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
export const readRepoURL = async function (url) {
    // eslint-disable-next-line n/no-deprecated-api -- TODO: use `url.URL()` instead
    const parsedURL = URL.parse(url);
    const repoHost = validateRepoURL(url);
    if (repoHost !== GITHUB) {
        throw new Error('only GitHub repos are supported for now');
    }
    const [ownerAndRepo, contentsPath] = parseRepoURL(repoHost, parsedURL);
    const folderContents = await getRepoURLContents(repoHost, ownerAndRepo, contentsPath);
    return folderContents;
};
const getRepoURLContents = async function (repoHost, ownerAndRepo, contentsPath) {
    // naive joining strategy for now
    if (repoHost === GITHUB) {
        // https://developer.github.com/v3/repos/contents/#get-contents
        const APIURL = `https://api.github.com/repos/${ownerAndRepo}/contents/${contentsPath}`;
        try {
            const res = await fetch(APIURL);
            return await res.json();
        }
        catch (error) {
            console.error(`Error occurred while fetching ${APIURL}`, error);
        }
    }
    throw new Error(`unsupported host: ${repoHost}`);
};
export const validateRepoURL = function (url) {
    // eslint-disable-next-line n/no-deprecated-api -- TODO: use `url.URL()` instead
    const parsedURL = URL.parse(url);
    if (parsedURL.host === 'github.com') {
        return GITHUB;
    }
    return null;
};
export const parseRepoURL = function (repoHost, url) {
    // naive splitting strategy for now
    if (repoHost === GITHUB) {
        // https://developer.github.com/v3/repos/contents/#get-contents
        // what if it's not master? note that our contents retrieval may assume it is master
        const [ownerAndRepo, contentsPath] = (url.path ?? '').slice(1).split('/tree/master/');
        return [ownerAndRepo, contentsPath];
    }
    throw new Error(`Unsupported host ${repoHost}`);
};
//# sourceMappingURL=read-repo-url.js.map