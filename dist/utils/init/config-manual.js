import inquirer from 'inquirer';
import { exit, log } from '../command-helpers.js';
import { createDeployKey, getBuildSettings, saveNetlifyToml, setupSite } from './utils.js';
/**
 * Prompts for granting the netlify ssh public key access to your repo
 */
const addDeployKey = async (deployKey) => {
    log('\nGive this Netlify SSH public key access to your repository:\n');
    // FIXME(serhalp): Handle nullish `deployKey.public_key` by throwing user-facing error or fixing upstream type.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    log(`\n${deployKey.public_key}\n\n`);
    const { sshKeyAdded } = (await inquirer.prompt([
        {
            type: 'confirm',
            name: 'sshKeyAdded',
            message: 'Continue?',
            default: true,
        },
    ]));
    if (!sshKeyAdded) {
        return exit();
    }
};
const getRepoPath = async ({ repoData }) => {
    const { repoPath } = await inquirer.prompt([
        {
            type: 'input',
            name: 'repoPath',
            message: 'The SSH URL of the remote git repo:',
            default: repoData.url,
            validate: (url) => (SSH_URL_REGEXP.test(url) ? true : 'The URL provided does not use the SSH protocol'),
        },
    ]);
    return repoPath;
};
const addDeployHook = async (deployHook) => {
    log('\nConfigure the following webhook for your repository:\n');
    // FIXME(serhalp): Handle nullish `deployHook` by throwing user-facing error or fixing upstream type.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    log(`\n${deployHook}\n\n`);
    const { deployHookAdded } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'deployHookAdded',
            message: 'Continue?',
            default: true,
        },
    ]);
    return deployHookAdded;
};
export default async function configManual({ command, repoData, siteId, }) {
    const { netlify } = command;
    const { api, cachedConfig: { configPath }, config, repositoryRoot, } = netlify;
    const { baseDir, buildCmd, buildDir, functionsDir, pluginsToInstall } = await getBuildSettings({
        config,
        command,
    });
    await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir });
    const deployKey = await createDeployKey({ api });
    await addDeployKey(deployKey);
    const repoPath = await getRepoPath({ repoData });
    const repo = {
        provider: 'manual',
        repo_path: repoPath,
        repo_branch: repoData.branch,
        allowed_branches: [repoData.branch],
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
    const deployHookAdded = await addDeployHook(updatedSite.deploy_hook);
    if (!deployHookAdded) {
        exit();
    }
}
const SSH_URL_REGEXP = /(ssh:\/\/|[a-zA-Z]*@|[a-zA-Z.].*:(?!\/\/))/;
//# sourceMappingURL=config-manual.js.map