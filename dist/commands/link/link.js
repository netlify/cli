import assert from 'node:assert';
import inquirer from 'inquirer';
import isEmpty from 'lodash/isEmpty.js';
import { listSites } from '../../lib/api.js';
import { startSpinner } from '../../lib/spinner.js';
import { chalk, logAndThrowError, exit, log, netlifyCommand } from '../../utils/command-helpers.js';
import getRepoData from '../../utils/get-repo-data.js';
import { ensureNetlifyIgnore } from '../../utils/gitignore.js';
import { track } from '../../utils/telemetry/index.js';
const findSiteByRepoUrl = async (api, repoUrl) => {
    log();
    const spinner = startSpinner({ text: `Looking for projects connected to '${repoUrl}'` });
    const sites = await listSites({ api, options: { filter: 'all' } });
    if (sites.length === 0) {
        spinner.error();
        return logAndThrowError(`You don't have any projects yet. Run ${chalk.cyanBright(`${netlifyCommand()} sites:create`)} to create a project.`);
    }
    const matchingSites = sites.filter(({ build_settings: buildSettings = {} }) => repoUrl === buildSettings.repo_url);
    if (matchingSites.length === 0) {
        spinner.error();
        log(chalk.redBright.bold.underline(`No matching project found`));
        log();
        log(`No project found with the remote ${repoUrl}.

Double check you are in the correct working directory and a remote origin repo is configured.

Run ${chalk.cyanBright('git remote -v')} to see a list of your git remotes.`);
        return exit(1);
    }
    if (matchingSites.length === 1) {
        spinner.success({ text: `Found 1 project connected to ${repoUrl}` });
        const [firstSite] = matchingSites;
        return firstSite;
    }
    spinner.warn({ text: `Found ${matchingSites.length} projects connected to ${repoUrl}` });
    const { selectedSite } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedSite',
            message: 'Which project do you want to link?',
            choices: matchingSites.map((matchingSite) => ({
                name: `${matchingSite.name} - ${matchingSite.ssl_url}`,
                value: matchingSite,
            })),
        },
    ]);
    if (!selectedSite) {
        return logAndThrowError('No project selected');
    }
    return selectedSite;
};
const linkPrompt = async (command, options) => {
    const { api, state } = command.netlify;
    const SITE_NAME_PROMPT = 'Search by full or partial project name';
    const SITE_LIST_PROMPT = 'Choose from a list of your recently updated projects';
    const SITE_ID_PROMPT = 'Enter a project ID';
    let GIT_REMOTE_PROMPT = 'Use the current git remote origin URL';
    let site;
    // Get git remote data if exists
    const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName });
    let linkChoices = [SITE_NAME_PROMPT, SITE_LIST_PROMPT, SITE_ID_PROMPT];
    if (!('error' in repoData)) {
        // Add git GIT_REMOTE_PROMPT if in a repo
        GIT_REMOTE_PROMPT = `Use current git remote origin (${repoData.httpsUrl})`;
        linkChoices = [GIT_REMOTE_PROMPT, ...linkChoices];
    }
    log();
    log(`${chalk.cyanBright(`${netlifyCommand()} link`)} will connect this folder to a project on Netlify`);
    log();
    const { linkType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'linkType',
            message: 'How do you want to link this folder to a project?',
            choices: linkChoices,
        },
    ]);
    let kind;
    switch (linkType) {
        case GIT_REMOTE_PROMPT: {
            // TODO(serhalp): Refactor function to avoid this. We can only be here if `repoData` is not an error.
            assert(!('error' in repoData));
            kind = 'gitRemote';
            site = await findSiteByRepoUrl(api, repoData.httpsUrl);
            break;
        }
        case SITE_NAME_PROMPT: {
            kind = 'byName';
            const { searchTerm } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'searchTerm',
                    message: 'Enter the project name (or just part of it):',
                },
            ]);
            log(`Looking for projects with names containing '${searchTerm}'...`);
            log();
            let matchingSites = [];
            try {
                matchingSites = await listSites({
                    api,
                    options: { name: searchTerm, filter: 'all' },
                });
            }
            catch (error_) {
                if (error_.status === 404) {
                    return logAndThrowError(`'${searchTerm}' not found`);
                }
                else {
                    return logAndThrowError(error_);
                }
            }
            if (!matchingSites || matchingSites.length === 0) {
                return logAndThrowError(`No project names found containing '${searchTerm}'.

Run ${chalk.cyanBright(`${netlifyCommand()} link`)} again to try a new search,
or run ${chalk.cyanBright(`npx ${netlifyCommand()} sites:create`)} to create a project.`);
            }
            if (matchingSites.length > 1) {
                log(`Found ${matchingSites.length} matching projects!`);
                const { selectedSite } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedSite',
                        message: 'Which project do you want to link?',
                        paginated: true,
                        choices: matchingSites.map((matchingSite) => ({ name: matchingSite.name, value: matchingSite })),
                    },
                ]);
                if (!selectedSite) {
                    return logAndThrowError('No project selected');
                }
                site = selectedSite;
            }
            else {
                const [firstSite] = matchingSites;
                site = firstSite;
            }
            break;
        }
        case SITE_LIST_PROMPT: {
            kind = 'fromList';
            log(`Fetching recently updated projects...`);
            log();
            let sites;
            try {
                sites = await listSites({ api, options: { maxPages: 1, filter: 'all' } });
            }
            catch (error_) {
                return logAndThrowError(error_);
            }
            if (!sites || sites.length === 0) {
                return logAndThrowError(`You don't have any projects yet. Run ${chalk.cyanBright(`${netlifyCommand()} sites:create`)} to create a project.`);
            }
            const { selectedSite } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'selectedSite',
                    message: 'Which project do you want to link?',
                    paginated: true,
                    choices: sites.map((matchingSite) => ({ name: matchingSite.name, value: matchingSite })),
                },
            ]);
            if (!selectedSite) {
                return logAndThrowError('No project selected');
            }
            site = selectedSite;
            break;
        }
        case SITE_ID_PROMPT: {
            kind = 'bySiteId';
            const { siteId } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'siteId',
                    message: 'What is the project ID?',
                },
            ]);
            try {
                site = await api.getSite({ siteId });
            }
            catch (error_) {
                if (error_.status === 404) {
                    return logAndThrowError(`Project ID '${siteId}' not found`);
                }
                else {
                    return logAndThrowError(error_);
                }
            }
            break;
        }
    }
    if (!site) {
        return logAndThrowError(new Error(`No project found`));
    }
    // Save site ID to config
    state.set('siteId', site.id);
    await track('sites_linked', {
        siteId: site.id,
        linkType: 'prompt',
        kind,
    });
    // Log output
    log();
    log(chalk.greenBright.bold.underline(`Directory Linked`));
    log();
    log(`Admin url: ${chalk.magentaBright(site.admin_url)}`);
    log(`Project url:  ${chalk.cyanBright(site.ssl_url || site.url)}`);
    log();
    log(`You can now run other \`netlify\` cli commands in this directory`);
    // FIXME(serhalp): Mismatch between hardcoded `SiteInfo` and generated Netlify API types.
    return site;
};
export const link = async (options, command) => {
    await command.authenticate();
    const { api, repositoryRoot, site: { id: siteId }, siteInfo, state, } = command.netlify;
    let initialSiteData;
    let newSiteData;
    // Add .netlify to .gitignore file
    await ensureNetlifyIgnore(repositoryRoot);
    // Site id is incorrect
    if (siteId && isEmpty(siteInfo)) {
        log(`"${siteId}" was not found in your Netlify account.`);
        log(`Please double check your project ID and which account you are logged into via \`${netlifyCommand()} status\`.`);
        return exit();
    }
    if (!isEmpty(siteInfo)) {
        // If already linked to project, exit and prompt for unlink
        initialSiteData = siteInfo;
        log(`Project already linked to "${initialSiteData.name}"`);
        log(`Admin url: ${initialSiteData.admin_url}`);
        log();
        log(`To unlink this project, run: ${chalk.cyanBright(`${netlifyCommand()} unlink`)}`);
    }
    else if (options.id) {
        try {
            // @ts-expect-error FIXME(serhalp): Mismatch between hardcoded `SiteInfo` and new generated Netlify API types.
            newSiteData = await api.getSite({ site_id: options.id });
        }
        catch (error_) {
            if (error_.status === 404) {
                return logAndThrowError(new Error(`Project id ${options.id} not found`));
            }
            else {
                return logAndThrowError(error_);
            }
        }
        // Save site ID
        state.set('siteId', newSiteData.id);
        log(`${chalk.green('✔')} Linked to ${newSiteData.name}`);
        await track('sites_linked', {
            siteId: newSiteData.id,
            linkType: 'manual',
            kind: 'byId',
        });
    }
    else if (options.name) {
        let results = [];
        try {
            results = await listSites({
                api,
                options: {
                    name: options.name,
                    filter: 'all',
                },
            });
        }
        catch (error_) {
            if (error_.status === 404) {
                return logAndThrowError(new Error(`${options.name} not found`));
            }
            else {
                return logAndThrowError(error_);
            }
        }
        if (results.length === 0) {
            return logAndThrowError(new Error(`No projects found named ${options.name}`));
        }
        const matchingSiteData = results.find((site) => site.name === options.name) || results[0];
        state.set('siteId', matchingSiteData.id);
        log(`${chalk.green('✔')} Linked to ${matchingSiteData.name}`);
        await track('sites_linked', {
            siteId: (matchingSiteData && matchingSiteData.id) || siteId,
            linkType: 'manual',
            kind: 'byName',
        });
    }
    else if (options.gitRemoteUrl) {
        newSiteData = await findSiteByRepoUrl(api, options.gitRemoteUrl);
        state.set('siteId', newSiteData.id);
        log(`${chalk.green('✔')} Linked to ${newSiteData.name}`);
        await track('sites_linked', {
            siteId: newSiteData.id,
            linkType: 'clone',
            kind: 'byRepoUrl',
        });
    }
    else {
        newSiteData = await linkPrompt(command, options);
    }
    // FIXME(serhalp): All the cases above except one (look up by site name) end up *returning*
    // the site data. This is probably not intentional and may result in bugs in deploy/init. Investigate.
    return initialSiteData || newSiteData;
};
//# sourceMappingURL=link.js.map