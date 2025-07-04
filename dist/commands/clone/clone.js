import inquirer from 'inquirer';
import { normalizeRepoUrl } from '../../utils/normalize-repo-url.js';
import { chalk, logAndThrowError, log } from '../../utils/command-helpers.js';
import { runGit } from '../../utils/run-git.js';
import { link } from '../link/link.js';
import { startSpinner } from '../../lib/spinner.js';
const getTargetDir = async (defaultDir) => {
    const { selectedDir } = await inquirer.prompt([
        {
            type: 'input',
            name: 'selectedDir',
            message: 'Where should we clone the repository?',
            default: defaultDir,
        },
    ]);
    return selectedDir;
};
const cloneRepo = async (repoUrl, targetDir, debug) => {
    try {
        await runGit(['clone', repoUrl, targetDir], !debug);
    }
    catch (error) {
        throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : error?.toString() ?? ''}`);
    }
};
export const clone = async (options, command, args) => {
    await command.authenticate();
    const { repoUrl, httpsUrl, repoName } = normalizeRepoUrl(args.repo);
    const targetDir = args.targetDir ?? (await getTargetDir(`./${repoName}`));
    const cloneSpinner = startSpinner({ text: `Cloning repository to ${chalk.cyan(targetDir)}` });
    try {
        await cloneRepo(repoUrl, targetDir, options.debug ?? false);
    }
    catch (error) {
        return logAndThrowError(error);
    }
    cloneSpinner.success(`Cloned repository to ${chalk.cyan(targetDir)}`);
    command.workingDir = targetDir;
    // TODO(serhalp): This shouldn't be necessary but `getPathInProject` does not take
    // `command.workingDir` into account. Carefully fix this and remove this line.
    process.chdir(targetDir);
    const { id, name, ...globalOptions } = options;
    const linkOptions = {
        ...globalOptions,
        id,
        name,
        // Use the normalized HTTPS URL as the canonical git URL for linking to ensure
        // we have a consistent URL format for looking up projects.
        gitRemoteUrl: httpsUrl,
    };
    await link(linkOptions, command);
    log();
    log(chalk.green('✔ Your project is ready to go!'));
    log(`→ Next, enter your project directory using ${chalk.cyanBright(`cd ${targetDir}`)}`);
    log();
    log(`→ You can now run other ${chalk.cyanBright('netlify')} CLI commands in this directory`);
    log(`→ To build and deploy your project: ${chalk.cyanBright('netlify deploy')}`);
    if (command.netlify.config.dev?.command) {
        log(`→ To run your dev server: ${chalk.cyanBright(command.netlify.config.dev.command)}`);
    }
    log(`→ To see all available commands: ${chalk.cyanBright('netlify help')}`);
    log();
};
//# sourceMappingURL=clone.js.map