import url from 'url';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'node... Remove this comment to see the full error message
import fetch from 'node-fetch';
// supported repo host types
const GITHUB = 'GitHub';
/**
 * @param {string} _url
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
// @ts-expect-error TS(7006) FIXME: Parameter '_url' implicitly has an 'any' type.
export const readRepoURL = async function (_url) {
    // TODO: use `url.URL()` instead
    // eslint-disable-next-line n/no-deprecated-api
    const URL = url.parse(_url);
    const repoHost = validateRepoURL(_url);
    if (repoHost !== GITHUB)
        throw new Error('only GitHub repos are supported for now');
    const [ownerAndRepo, contentsPath] = parseRepoURL(repoHost, URL);
    const folderContents = await getRepoURLContents(repoHost, ownerAndRepo, contentsPath);
    return folderContents;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'repoHost' implicitly has an 'any' type.
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
    throw new Error('unsupported host ', repoHost);
};
/**
 * @param {string} _url
 */
// @ts-expect-error TS(7006) FIXME: Parameter '_url' implicitly has an 'any' type.
export const validateRepoURL = function (_url) {
    // TODO: use `url.URL()` instead
    // eslint-disable-next-line n/no-deprecated-api
    const URL = url.parse(_url);
    if (URL.host !== 'github.com')
        return null;
    // other validation logic here
    return GITHUB;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'repoHost' implicitly has an 'any' type.
export const parseRepoURL = function (repoHost, URL) {
    // naive splitting strategy for now
    if (repoHost === GITHUB) {
        // https://developer.github.com/v3/repos/contents/#get-contents
        // what if it's not master? note that our contents retrieval may assume it is master
        const [ownerAndRepo, contentsPath] = URL.path.slice(1).split('/tree/master/');
        return [ownerAndRepo, contentsPath];
    }
    throw new Error(`Unsupported host ${repoHost}`);
};
