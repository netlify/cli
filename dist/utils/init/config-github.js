import { Octokit } from '@octokit/rest';
import { chalk, logAndThrowError, log } from '../command-helpers.js';
import { getGitHubToken as ghauth } from '../gh-auth.js';
import { createDeployKey, formatErrorMessage, getBuildSettings, saveNetlifyToml, setupSite } from './utils.js';
const formatRepoAndOwner = ({ repoName, repoOwner }) => ({
    name: chalk.magenta(repoName),
    owner: chalk.magenta(repoOwner),
});
const PAGE_SIZE = 100;
/**
 * Get a valid GitHub token
 */
export const getGitHubToken = async ({ globalConfig }) => {
    const userId = globalConfig.get('userId');
    const githubToken = globalConfig.get(`users.${userId}.auth.github`);
    if (githubToken?.user && githubToken.token) {
        try {
            const octokit = getGitHubClient(githubToken.token);
            const { status } = await octokit.rest.users.getAuthenticated();
            if (status < 400) {
                return githubToken.token;
            }
        }
        catch {
            log(chalk.yellow('Token is expired or invalid!'));
            log('Generating a new Github token...');
        }
    }
    const newToken = await ghauth();
    globalConfig.set(`users.${userId}.auth.github`, newToken);
    return newToken.token;
};
const getGitHubClient = (token) => new Octokit({
    auth: `token ${token}`,
});
const addDeployKey = async ({ api, octokit, repoName, repoOwner, }) => {
    log('Adding deploy key to repository...');
    const key = await createDeployKey({ api });
    try {
        await octokit.repos.createDeployKey({
            title: 'Netlify Deploy Key',
            key: key.public_key ?? '',
            owner: repoOwner,
            repo: repoName,
            read_only: true,
        });
        log('Deploy key added!');
        return key;
    }
    catch (error) {
        let message = formatErrorMessage({ message: 'Failed adding GitHub deploy key', error });
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error.status === 404) {
            const { name, owner } = formatRepoAndOwner({ repoName, repoOwner });
            message = `${message}. Does the repository ${name} exist and do ${owner} has the correct permissions to set up deploy keys?`;
        }
        return logAndThrowError(message);
    }
};
const getGitHubRepo = async ({ octokit, repoName, repoOwner, }) => {
    try {
        const { data } = await octokit.repos.get({
            owner: repoOwner,
            repo: repoName,
        });
        return data;
    }
    catch (error) {
        let message = formatErrorMessage({ message: 'Failed retrieving GitHub repository information', error });
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error.status === 404) {
            const { name, owner } = formatRepoAndOwner({ repoName, repoOwner });
            message = `${message}. Does the repository ${name} exist and accessible by ${owner}`;
        }
        return logAndThrowError(message);
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'deployHook' implicitly has an 'an... Remove this comment to see the full error message
const hookExists = async ({ deployHook, octokit, repoName, repoOwner }) => {
    try {
        const { data: hooks } = await octokit.repos.listWebhooks({
            owner: repoOwner,
            repo: repoName,
            per_page: PAGE_SIZE,
        });
        // @ts-expect-error TS(7006) FIXME: Parameter 'hook' implicitly has an 'any' type.
        const exists = hooks.some((hook) => hook.config.url === deployHook);
        return exists;
    }
    catch {
        // we don't need to fail if listHooks errors out
        return false;
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'deployHook' implicitly has an 'an... Remove this comment to see the full error message
const addDeployHook = async ({ deployHook, octokit, repoName, repoOwner }) => {
    const exists = await hookExists({ deployHook, octokit, repoOwner, repoName });
    if (!exists) {
        try {
            await octokit.repos.createWebhook({
                owner: repoOwner,
                repo: repoName,
                name: 'web',
                config: {
                    url: deployHook,
                    content_type: 'json',
                },
                events: ['push', 'pull_request', 'delete'],
                active: true,
            });
        }
        catch (error) {
            // Ignore exists error if the list doesn't return all installed hooks
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            if (!error.message.includes('Hook already exists on this repository')) {
                let message = formatErrorMessage({ message: 'Failed creating repo hook', error });
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                if (error.status === 404) {
                    const { name, owner } = formatRepoAndOwner({ repoName, repoOwner });
                    message = `${message}. Does the repository ${name} and do ${owner} has the correct permissions to set up hooks`;
                }
                return logAndThrowError(message);
            }
        }
    }
};
const GITHUB_HOOK_EVENTS = ['deploy_created', 'deploy_failed', 'deploy_building'];
const GITHUB_HOOK_TYPE = 'github_commit_status';
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const upsertHook = async ({ api, event, ntlHooks, siteId, token }) => {
    // @ts-expect-error TS(7006) FIXME: Parameter 'hook' implicitly has an 'any' type.
    const ntlHook = ntlHooks.find((hook) => hook.type === GITHUB_HOOK_TYPE && hook.event === event);
    if (!ntlHook || ntlHook.disabled) {
        return await api.createHookBySiteId({
            site_id: siteId,
            body: {
                type: GITHUB_HOOK_TYPE,
                event,
                data: {
                    access_token: token,
                },
            },
        });
    }
    return await api.updateHook({
        hook_id: ntlHook.id,
        body: {
            data: {
                access_token: token,
            },
        },
    });
};
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const addNotificationHooks = async ({ api, siteId, token }) => {
    log(`Creating Netlify GitHub Notification Hooks...`);
    let ntlHooks;
    try {
        ntlHooks = await api.listHooksBySiteId({ siteId });
    }
    catch (error) {
        const message = formatErrorMessage({ message: 'Failed retrieving Netlify hooks', error });
        return logAndThrowError(message);
    }
    await Promise.all(GITHUB_HOOK_EVENTS.map(async (event) => {
        try {
            await upsertHook({ ntlHooks, event, api, siteId, token });
        }
        catch (error) {
            const message = formatErrorMessage({ message: `Failed settings Netlify hook ${chalk.magenta(event)}`, error });
            return logAndThrowError(message);
        }
    }));
    log(`Netlify Notification Hooks configured!`);
};
export const configGithub = async ({ command, repoName, repoOwner, siteId, }) => {
    const { netlify } = command;
    const { api, cachedConfig: { configPath }, config, globalConfig, repositoryRoot, } = netlify;
    const token = await getGitHubToken({ globalConfig });
    const { baseDir, buildCmd, buildDir, functionsDir, pluginsToInstall } = await getBuildSettings({
        config,
        command,
    });
    await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir });
    log();
    const octokit = getGitHubClient(token);
    const [deployKey, githubRepo] = await Promise.all([
        addDeployKey({ api, octokit, repoOwner, repoName }),
        getGitHubRepo({ octokit, repoOwner, repoName }),
    ]);
    const repo = {
        id: githubRepo.id,
        provider: 'github',
        repo_path: githubRepo.full_name,
        repo_branch: githubRepo.default_branch,
        allowed_branches: [githubRepo.default_branch],
        deploy_key_id: deployKey.id,
        base: baseDir,
        dir: buildDir,
        functions_dir: functionsDir,
        ...(buildCmd && { cmd: buildCmd }),
    };
    const updatedSite = await setupSite({
        api,
        siteId,
        repo,
        configPlugins: config.plugins ?? [],
        pluginsToInstall,
    });
    await addDeployHook({ deployHook: updatedSite.deploy_hook, octokit, repoOwner, repoName });
    log();
    await addNotificationHooks({ siteId, api, token });
};
//# sourceMappingURL=config-github.js.map