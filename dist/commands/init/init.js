import inquirer from 'inquirer';
import isEmpty from 'lodash/isEmpty.js';
import { chalk, exit, log, netlifyCommand } from '../../utils/command-helpers.js';
import getRepoData from '../../utils/get-repo-data.js';
import { ensureNetlifyIgnore } from '../../utils/gitignore.js';
import { configureRepo } from '../../utils/init/config.js';
import { track } from '../../utils/telemetry/index.js';
import { link } from '../link/link.js';
import { sitesCreate } from '../sites/sites-create.js';
import { getBuildSettings, saveNetlifyToml } from '../../utils/init/utils.js';
import { LINKED_EXISTING_SITE_EXIT_CODE, LINKED_NEW_SITE_EXIT_CODE } from './constants.js';
const persistState = ({ siteInfo, state }) => {
    // Save to .netlify/state.json file
    state.set('siteId', siteInfo.id);
};
const getRepoUrl = (siteInfo) => siteInfo.build_settings?.repo_url ?? '';
const logExistingAndExit = ({ siteInfo }) => {
    log();
    log(`This project has been initialized`);
    log();
    log(`Project Name:  ${chalk.cyan(siteInfo.name)}`);
    log(`Project Url:   ${chalk.cyan(siteInfo.ssl_url || siteInfo.url)}`);
    log(`Project Repo:  ${chalk.cyan(getRepoUrl(siteInfo))}`);
    log(`Project Id:    ${chalk.cyan(siteInfo.id)}`);
    log(`Admin URL:  ${chalk.cyan(siteInfo.admin_url)}`);
    log();
    log(`To disconnect this directory and create a new project (or link to another project ID)`);
    log(`1. Run ${chalk.cyanBright.bold(`${netlifyCommand()} unlink`)}`);
    log(`2. Then run ${chalk.cyanBright.bold(`${netlifyCommand()} init`)} again`);
    return exit();
};
/**
 * Creates and new site and exits the process
 */
const createNewSiteAndExit = async ({ command, state, disableLinking, customizeExitMessage, }) => {
    const siteInfo = await sitesCreate({}, command);
    log(`"${siteInfo.name}" project was created`);
    log();
    persistState({ state, siteInfo });
    if (!disableLinking) {
        const { shouldConfigureBuild } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'shouldConfigureBuild',
                message: `Do you want to configure build settings? We'll suggest settings for your project automatically`,
            },
        ]);
        if (shouldConfigureBuild) {
            const { cachedConfig: { configPath }, config, repositoryRoot, } = command.netlify;
            const { baseDir, buildCmd, buildDir, functionsDir } = await getBuildSettings({
                config,
                command,
            });
            await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir });
        }
    }
    log();
    const defaultExitMesage = `To deploy to this project, run ${chalk.cyanBright.bold(`${netlifyCommand()} deploy`)}.`;
    log(customizeExitMessage?.(LINKED_NEW_SITE_EXIT_CODE, defaultExitMesage) ?? defaultExitMesage);
    return exit();
};
const logGitSetupInstructionsAndExit = () => {
    log();
    log(`${chalk.bold('To initialize a new git repo follow the steps below.')}

1. Initialize a new repo:

   ${chalk.cyanBright.bold('git init')}

2. Add your files

   ${chalk.cyanBright.bold('git add .')}

3. Commit your files

   ${chalk.cyanBright.bold("git commit -m 'initial commit'")}

4. Create a new repo in GitHub ${chalk.cyanBright.bold('https://github.com/new')}

5. Link the remote repo with this local directory

   ${chalk.cyanBright.bold('git remote add origin git@github.com:YourGithubName/your-repo-slug.git')}

6. Push up your files

   ${chalk.cyanBright.bold('git push -u origin main')}

7. Initialize your Netlify Site

   ${chalk.cyanBright.bold(`${netlifyCommand()} init`)}
`);
    return exit();
};
/**
 * Handles the case where no git remote was found.
 */
const handleNoGitRemoteAndExit = async ({ command, error, state, disableLinking, customizeExitMessage, }) => {
    log();
    log(chalk.yellow('No git remote was found, would you like to set one up?'));
    log(`
It is recommended that you initialize a project that has a remote repository in GitHub.

This will allow for Netlify Continuous deployment to build branch & PR previews.

For more details on Netlify CI check out the docs: http://bit.ly/2N0Jhy5
`);
    if (error === "Couldn't find origin url") {
        log(`Unable to find a remote origin URL. Please add a git remote.

git remote add origin https://github.com/YourUserName/RepoName.git
`);
    }
    const NEW_SITE_NO_GIT = 'Yes, create and deploy project manually';
    const NO_ABORT = 'No, I will connect this directory with GitHub first';
    const { noGitRemoteChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'noGitRemoteChoice',
            message: 'Do you want to create a Netlify project without a git repository?',
            choices: [NEW_SITE_NO_GIT, NO_ABORT],
        },
    ]);
    if (noGitRemoteChoice === NEW_SITE_NO_GIT) {
        // TODO(ndhoule): Shove a custom error message in here
        return createNewSiteAndExit({ state, command, disableLinking, customizeExitMessage });
    }
    return logGitSetupInstructionsAndExit();
};
/**
 * Creates a new site or links an existing one to the repository
 */
const createOrLinkSiteToRepo = async (command) => {
    const NEW_SITE = '+  Create & configure a new project';
    const EXISTING_SITE = '⇄  Connect this directory to an existing Netlify project';
    const initializeOpts = [EXISTING_SITE, NEW_SITE];
    // TODO(serhalp): inquirer should infer the choice type here, but doesn't. Fix.
    const { initChoice } = await inquirer.prompt([
        {
            type: 'list',
            name: 'initChoice',
            message: 'What would you like to do?',
            choices: initializeOpts,
        },
    ]);
    // create site or search for one
    if (initChoice === NEW_SITE) {
        await track('sites_initStarted', {
            type: 'new site',
        });
        return await sitesCreate({}, command);
    }
    // run link command
    return await link({}, command);
};
const logExistingRepoSetupAndExit = ({ repoUrl, siteName, customizeExitMessage, }) => {
    log();
    log(chalk.underline.bold(`Success`));
    const defaultExitMessage = `This project "${siteName}" is configured to automatically deploy via ${repoUrl}.`;
    log(customizeExitMessage?.(LINKED_EXISTING_SITE_EXIT_CODE, defaultExitMessage) ?? defaultExitMessage);
    // TODO add support for changing GitHub repo in site:config command
    exit();
};
export const init = async (options, command, { customizeExitMessage, exitAfterConfiguringRepo = false } = {}) => {
    command.setAnalyticsPayload({ manual: options.manual, force: options.force });
    const { repositoryRoot, state } = command.netlify;
    const { siteInfo: existingSiteInfo } = command.netlify;
    // Check logged in status
    await command.authenticate();
    // Add .netlify to .gitignore file
    await ensureNetlifyIgnore(repositoryRoot);
    const repoUrl = getRepoUrl(existingSiteInfo);
    if (repoUrl && !options.force) {
        logExistingAndExit({ siteInfo: existingSiteInfo });
    }
    // Look for local repo
    const repoData = await getRepoData({ workingDir: command.workingDir, remoteName: options.gitRemoteName });
    if ('error' in repoData) {
        // TODO(ndhoule): Custom error messaage here
        return await handleNoGitRemoteAndExit({
            command,
            error: repoData.error,
            state,
            disableLinking: options.disableLinking,
            customizeExitMessage,
        });
    }
    const siteInfo = isEmpty(existingSiteInfo) ? await createOrLinkSiteToRepo(command) : existingSiteInfo;
    log();
    // Check for existing CI setup
    const remoteBuildRepo = getRepoUrl(siteInfo);
    if (remoteBuildRepo && !options.force) {
        logExistingRepoSetupAndExit({ siteName: siteInfo.name, repoUrl: remoteBuildRepo, customizeExitMessage });
    }
    persistState({ state, siteInfo });
    await configureRepo({ command, siteId: siteInfo.id, repoData, manual: options.manual });
    if (exitAfterConfiguringRepo) {
        const customErrorMessage = customizeExitMessage?.(LINKED_EXISTING_SITE_EXIT_CODE, '');
        if (customErrorMessage) {
            log(customErrorMessage);
        }
        return exit();
    }
    return siteInfo;
};
//# sourceMappingURL=init.js.map