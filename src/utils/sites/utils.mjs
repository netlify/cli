// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'node... Remove this comment to see the full error message
import fetch from 'node-fetch';
// @ts-expect-error TS(7006) FIXME: Parameter 'token' implicitly has an 'any' type.
export const getTemplatesFromGitHub = async (token) => {
    const getPublicGitHubReposFromOrg = new URL(`https://api.github.com/orgs/netlify-templates/repos`);
    // GitHub returns 30 by default and we want to avoid our limit
    // due to our archived repositories at any given time
    const REPOS_PER_PAGE = 70;
    getPublicGitHubReposFromOrg.searchParams.set('type', 'public');
    getPublicGitHubReposFromOrg.searchParams.set('sort', 'full_name');
    // @ts-expect-error TS(2345) FIXME: Argument of type 'number' is not assignable to par... Remove this comment to see the full error message
    getPublicGitHubReposFromOrg.searchParams.set('per_page', REPOS_PER_PAGE);
    const templates = await fetch(getPublicGitHubReposFromOrg, {
        method: 'GET',
        headers: {
            Authorization: `token ${token}`,
        },
    });
    const allTemplates = await templates.json();
    return allTemplates;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'ghToken' implicitly has an 'any' ... Remove this comment to see the full error message
export const validateTemplate = async ({ ghToken, templateName }) => {
    const response = await fetch(`https://api.github.com/repos/${templateName}`, {
        headers: {
            Authorization: `token ${ghToken}`,
        },
    });
    if (response.status === 404) {
        return { exists: false };
    }
    if (!response.ok) {
        throw new Error(`Error fetching template ${templateName}: ${await response.text()}`);
    }
    const data = await response.json();
    return { exists: true, isTemplate: data.is_template };
};
// @ts-expect-error TS(7006) FIXME: Parameter 'templateName' implicitly has an 'any' t... Remove this comment to see the full error message
export const createRepo = async (templateName, ghToken, siteName) => {
    const resp = await fetch(`https://api.github.com/repos/${templateName}/generate`, {
        method: 'POST',
        headers: {
            Authorization: `token ${ghToken}`,
        },
        body: JSON.stringify({
            name: siteName,
        }),
    });
    const data = await resp.json();
    return data;
};
