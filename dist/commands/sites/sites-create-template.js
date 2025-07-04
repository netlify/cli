import path from 'node:path';
import { fileURLToPath } from 'node:url';
import inquirer from 'inquirer';
import pick from 'lodash/pick.js';
import { render } from 'prettyjson';
import { v4 as uuid } from 'uuid';
import { chalk, logAndThrowError, getTerminalLink, log, logJson, warn, GitHubAPIError, } from '../../utils/command-helpers.js';
import execa from '../../utils/execa.js';
import getRepoData from '../../utils/get-repo-data.js';
import { getGitHubToken } from '../../utils/init/config-github.js';
import { configureRepo } from '../../utils/init/config.js';
import { deployedSiteExists, getGitHubLink, getTemplateName } from '../../utils/sites/create-template.js';
import { callLinkSite, createRepo, validateTemplate } from '../../utils/sites/utils.js';
import { track } from '../../utils/telemetry/index.js';
import { getSiteNameInput } from './sites-create.js';
export const sitesCreateTemplate = async (repository, options, command) => {
    const { accounts, api } = command.netlify;
    await command.authenticate();
    const { globalConfig } = command.netlify;
    const ghToken = await getGitHubToken({ globalConfig });
    const templateName = await getTemplateName({ ghToken, options, repository });
    const { exists, isTemplate } = await validateTemplate({ templateName, ghToken });
    if (!exists) {
        const githubLink = getGitHubLink({ options, templateName });
        return logAndThrowError(`Could not find template ${chalk.bold(templateName)}. Please verify it exists and you can ${getTerminalLink('access to it on GitHub', githubLink)}`);
    }
    if (!isTemplate) {
        const githubLink = getGitHubLink({ options, templateName });
        return logAndThrowError(`${getTerminalLink(chalk.bold(templateName), githubLink)} is not a valid GitHub template`);
    }
    let { accountSlug } = options;
    if (!accountSlug) {
        const { accountSlug: accountSlugInput } = await inquirer.prompt([
            {
                type: 'list',
                name: 'accountSlug',
                message: 'Team:',
                choices: accounts.map((account) => ({
                    value: account.slug,
                    name: account.name,
                })),
            },
        ]);
        accountSlug = accountSlugInput;
    }
    const { name: nameFlag } = options;
    let site;
    let repoResp;
    // Allow the user to reenter project name if selected one isn't available
    const inputSiteName = async (name, hasExistingRepo) => {
        const { name: inputName } = await getSiteNameInput(name);
        const siteName = inputName.trim();
        if (siteName && (await deployedSiteExists(siteName))) {
            log('A project with that name already exists');
            return inputSiteName();
        }
        try {
            const sites = await api.listSites({ name: siteName, filter: 'all' });
            const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName);
            if (siteFoundByName) {
                log('A project with that name already exists on your account');
                return inputSiteName();
            }
        }
        catch (error_) {
            return logAndThrowError(error_);
        }
        if (!hasExistingRepo) {
            try {
                // Create new repo from template
                let gitHubInputName = siteName || templateName;
                repoResp = await createRepo(templateName, ghToken, gitHubInputName);
                if (repoResp.errors && repoResp.errors[0].includes('Name already exists on this account')) {
                    if (gitHubInputName === templateName) {
                        gitHubInputName += `-${uuid().split('-')[0]}`;
                        repoResp = await createRepo(templateName, ghToken, gitHubInputName);
                    }
                    else {
                        warn(`It seems you have already created a repository with the name ${gitHubInputName}.`);
                        return inputSiteName();
                    }
                }
                if (!repoResp.id) {
                    throw new GitHubAPIError(repoResp.status, repoResp.message);
                }
                hasExistingRepo = true;
            }
            catch (error_) {
                if (error_.status === '404') {
                    return logAndThrowError(`Could not create repository: ${error_.message}. Ensure that your GitHub personal access token grants permission to create repositories`);
                }
                else {
                    return logAndThrowError(`Something went wrong trying to create the repository. We're getting the following error: '${error_.message}'. You can try to re-run this command again or open an issue in our repository: https://github.com/netlify/cli/issues`);
                }
            }
        }
        try {
            // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
            site = (await api.createSiteInTeam({
                accountSlug,
                body: {
                    repo: {
                        provider: 'github',
                        // @ts-expect-error -- FIXME(serhalp): Supposedly this is does not exist. Investigate.
                        repo: repoResp.full_name,
                        // FIXME(serhalp): Supposedly this should be `public_repo`. Investigate.
                        private: repoResp.private,
                        // FIXME(serhalp): Supposedly this should be `repo_branch`. Investigate.
                        branch: repoResp.default_branch,
                    },
                    name: siteName,
                },
            }));
        }
        catch (error_) {
            if (error_.status === 422) {
                log(`createSiteInTeam error: ${error_.status}: ${error_.message}`);
                log('Cannot create a project with that name. Project name may already exist. Please try a new name.');
                return inputSiteName(undefined, hasExistingRepo);
            }
            return logAndThrowError(`createSiteInTeam error: ${error_.status}: ${error_.message}`);
        }
        return [site, repoResp];
    };
    [site, repoResp] = await inputSiteName(nameFlag);
    log();
    log(chalk.greenBright.bold.underline(`Project Created`));
    log();
    const siteUrl = site.ssl_url || site.url;
    log(render({
        'Admin URL': site.admin_url,
        URL: siteUrl,
        'Project ID': site.id,
        'Repo URL': site.build_settings?.repo_url ?? '',
    }));
    track('sites_createdFromTemplate', {
        siteId: site.id,
        adminUrl: site.admin_url,
        siteUrl,
    });
    const { cloneConfirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'cloneConfirm',
        message: `Do you want to clone the repository to your local machine?`,
        default: true,
    });
    if (cloneConfirm) {
        log();
        if (repoResp.clone_url) {
            await execa('git', ['clone', repoResp.clone_url, `${repoResp.name}`]);
        }
        log(`🚀 Repository cloned successfully. You can find it under the ${chalk.magenta(repoResp.name)} folder`);
        const { linkConfirm } = await inquirer.prompt({
            type: 'confirm',
            name: 'linkConfirm',
            message: `Do you want to link the cloned directory to the project?`,
            default: true,
        });
        if (linkConfirm) {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const cliPath = path.resolve(__dirname, '../../../bin/run.js');
            let stdout;
            // TODO(serhalp): Why is this condition here? We've asked the user multiple prompts, but we already knew we had
            // invalid repo data. Move upstream.
            if (repoResp.name) {
                stdout = await callLinkSite(cliPath, repoResp.name, '\n');
            }
            else {
                return logAndThrowError('Failed to fetch the repo');
            }
            const linkedSiteUrlRegex = /Project url:\s+(\S+)/;
            const lineMatch = linkedSiteUrlRegex.exec(stdout);
            const urlMatch = lineMatch ? lineMatch[1] : undefined;
            if (urlMatch) {
                log(`\nDirectory ${chalk.cyanBright(repoResp.name)} linked to project ${chalk.cyanBright(urlMatch)}\n`);
                log(`${chalk.cyanBright.bold('cd', repoResp.name)} to use other netlify cli commands in the cloned directory.\n`);
            }
            else {
                const linkedSiteMatch = /Project already linked to\s+(\S+)/.exec(stdout);
                const linkedSiteNameMatch = linkedSiteMatch ? linkedSiteMatch[1] : undefined;
                if (linkedSiteNameMatch) {
                    log(`\nThis directory appears to be linked to ${chalk.cyanBright(linkedSiteNameMatch)}`);
                    log('This can happen if you cloned the template into a subdirectory of an existing Netlify project.');
                    log(`You may need to move the ${chalk.cyanBright(repoResp.name)} directory out of its parent directory and then re-run the ${chalk.cyanBright('link')} command manually\n`);
                }
                else {
                    log('A problem occurred linking the project');
                    log('You can try again manually by running:');
                    log(chalk.cyanBright(`cd ${repoResp.name} && netlify link\n`));
                }
            }
        }
        else {
            log('To link the cloned directory manually, run:');
            log(chalk.cyanBright(`cd ${repoResp.name} && netlify link\n`));
        }
    }
    if (options.withCi) {
        log('Configuring CI');
        const repoData = await getRepoData({ workingDir: command.workingDir });
        if ('error' in repoData) {
            return logAndThrowError('Failed to get repo data');
        }
        await configureRepo({ command, siteId: site.id, repoData, manual: options.manual });
    }
    if (options.json) {
        logJson(pick(site, [
            'id',
            'state',
            'plan',
            'name',
            'custom_domain',
            'domain_aliases',
            'url',
            'ssl_url',
            'admin_url',
            'screenshot_url',
            'created_at',
            'updated_at',
            'user_id',
            'ssl',
            'force_ssl',
            'managed_dns',
            'deploy_url',
            'account_name',
            'account_slug',
            'git_provider',
            'deploy_hook',
            'capabilities',
            'id_domain',
        ]));
    }
    return site;
};
//# sourceMappingURL=sites-create-template.js.map