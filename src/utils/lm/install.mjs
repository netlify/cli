import { appendFile, copyFile, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path, { dirname } from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import execa from 'execa';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'hasb... Remove this comment to see the full error message
import hasbin from 'hasbin';
import { Listr } from 'listr2';
import pathKey from 'path-key';
import { fetchLatestVersion, shouldFetchLatestVersion } from '../../lib/exec-fetcher.mjs';
import { fileExistsAsync } from '../../lib/fs.mjs';
import { normalizeBackslash } from '../../lib/path.mjs';
import { getLegacyPathInHome, getPathInHome } from '../../lib/settings.mjs';
import { chalk } from '../command-helpers.mjs';
import { checkGitLFSVersionStep, checkGitVersionStep, checkLFSFiltersStep } from './steps.mjs';
const PACKAGE_NAME = 'netlify-credential-helper';
const EXEC_NAME = 'git-credential-netlify';
const GIT_CONFIG = '.gitconfig';
const SUPPORTED_PLATFORMS = {
    linux: 'Linux',
    darwin: 'Mac OS X',
    win32: 'Windows',
};
const dirPath = dirname(fileURLToPath(import.meta.url));
// @ts-expect-error TS(7031) FIXME: Binding element 'skipInstall' implicitly has an 'a... Remove this comment to see the full error message
const getSetupStep = ({ skipInstall }) => {
    const platform = os.platform();
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const platformName = SUPPORTED_PLATFORMS[platform];
    if (platformName === undefined) {
        throw new Error(`Platform not supported: ${platform}.
See manual setup instructions in https://github.com/netlify/netlify-credential-helper#install`);
    }
    return {
        title: `Installing Netlify's Git Credential Helper for ${platformName}`,
        skip: () => {
            if (skipInstall) {
                return `Netlify's Git Credential Helper already installed with a package manager`;
            }
        },
        task: async () => {
            await installHelper();
            await (platform === 'win32' ? setupWindowsPath() : setupUnixPath());
        },
    };
};
const setupGitConfigStep = {
    title: `Configuring Git to use Netlify's Git Credential Helper`,
    task: () => configureGitConfig(),
};
// @ts-expect-error TS(7031) FIXME: Binding element 'force' implicitly has an 'any' ty... Remove this comment to see the full error message
export const installPlatform = async function ({ force }) {
    const skipInstall = !force && (await installedWithPackageManager());
    const steps = [
        checkGitVersionStep,
        checkGitLFSVersionStep,
        // @ts-expect-error TS(7006) FIXME: Parameter 'ctx' implicitly has an 'any' type.
        checkLFSFiltersStep(async (ctx, task, installed) => {
            if (!installed) {
                await execa('git', ['lfs', 'install']);
                task.title += chalk.dim(' [installed]');
            }
        }),
        getSetupStep({ skipInstall }),
        setupGitConfigStep,
    ];
    const tasks = new Listr(steps);
    await tasks.run();
    return !skipInstall;
};
const installedWithPackageManager = async function () {
    const installed = hasbin.sync('git-credential-netlify');
    if (!installed) {
        return false;
    }
    // we check for the older location too via getLegacyBinPath
    const binExist = await Promise.all([getBinPath(), getLegacyBinPath()].map(fileExistsAsync));
    const withPackageManager = binExist.every((exists) => !exists);
    return withPackageManager;
};
const installHelper = async function () {
    // remove any old versions that might still exist in `~/.netlify/helper/bin`
    await rm(getLegacyBinPath(), { force: true, recursive: true });
    const binPath = getBinPath();
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ binPath: string; packageName: ... Remove this comment to see the full error message
    const shouldFetch = await shouldFetchLatestVersion({
        binPath,
        packageName: PACKAGE_NAME,
        execArgs: ['version'],
        pattern: `${EXEC_NAME}\\/v?([^\\s]+)`,
        execName: EXEC_NAME,
    });
    if (!shouldFetch) {
        return;
    }
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ packageName: string; execName:... Remove this comment to see the full error message
    await fetchLatestVersion({
        packageName: PACKAGE_NAME,
        execName: EXEC_NAME,
        destination: binPath,
        extension: process.platform === 'win32' ? 'zip' : 'tar.gz',
    });
};
export const isBinInPath = () => {
    const envPath = process.env[pathKey()];
    const binPath = getBinPath();
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return envPath.replace(/"+/g, '').split(path.delimiter).includes(binPath);
};
const setupWindowsPath = async function () {
    if (isBinInPath()) {
        return true;
    }
    const scriptPath = path.join(dirPath, 'scripts', 'path.ps1');
    return await execa('powershell', ['-ExecutionPolicy', 'unrestricted', '-windowstyle', 'hidden', '-File', scriptPath, getBinPath()], { stdio: 'inherit' });
};
const CONTENT_COMMENT = `
# The next line updates PATH for Netlify's Git Credential Helper.
`;
// @ts-expect-error TS(7006) FIXME: Parameter 'incFilePath' implicitly has an 'any' ty... Remove this comment to see the full error message
const getInitContent = (incFilePath) => `${CONTENT_COMMENT}test -f '${incFilePath}' && source '${incFilePath}'`;
const setupUnixPath = async () => {
    if (isBinInPath()) {
        return true;
    }
    const { configFile, incFilePath, shell } = getShellInfo();
    if (configFile === undefined) {
        const error = `Unable to set credential helper in PATH. We don't how to set the path for ${shell} shell.
Set the helper path in your environment PATH: ${getBinPath()}`;
        throw new Error(error);
    }
    return await Promise.all([
        await copyFile(`${dirPath}/scripts/${shell}.sh`, incFilePath),
        await writeConfig(configFile, getInitContent(incFilePath)),
    ]);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
const writeConfig = async function (name, initContent) {
    const configPath = path.join(os.homedir(), name);
    if (!(await fileExistsAsync(configPath))) {
        return;
    }
    const content = await readFile(configPath, 'utf8');
    if (content.includes(initContent)) {
        return;
    }
    return await appendFile(configPath, initContent, 'utf-8');
};
const getCurrentCredentials = async () => {
    try {
        const { stdout } = await execa('git', ['config', '--no-includes', '--get-regexp', '^credential']);
        const currentCredentials = stdout.split('\\n');
        return currentCredentials;
    }
    catch (error) {
        // ignore error caused by not having any credential configured
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error.stdout !== '') {
            throw error;
        }
        return [];
    }
};
// Git expects the config path to always use / even on Windows
// @ts-expect-error TS(7006) FIXME: Parameter 'gitConfigPath' implicitly has an 'any' ... Remove this comment to see the full error message
const getGitConfigContent = (gitConfigPath) => `
# This next lines include Netlify's Git Credential Helper configuration in your Git configuration.
[include]
  path = ${normalizeBackslash(gitConfigPath)}
`;
const configureGitConfig = async function () {
    const currentCredentials = await getCurrentCredentials();
    let helperConfig = `
# The first line resets the list of helpers so we can check Netlify's first.
[credential]
  helper = ""

[credential]
  helper = netlify
`;
    let section = 'credential';
    if (currentCredentials.length !== 0) {
        currentCredentials.forEach((line) => {
            const parts = line.split(' ');
            if (parts.length === 2) {
                const keys = parts[0].split('.');
                const localSection = keys.slice(0, -1).join('.');
                if (section !== localSection) {
                    helperConfig += keys.length > 2 ? `\n[credential "${keys[1]}"]\n` : '\n[credential]\n';
                    section = localSection;
                }
                helperConfig += `  ${keys.pop()} = ${parts[1]}\n`;
            }
        });
    }
    const gitConfigPath = getGitConfigPath();
    await writeFile(gitConfigPath, helperConfig, 'utf-8');
    return writeConfig(GIT_CONFIG, getGitConfigContent(gitConfigPath));
};
const getHelperPath = function () {
    return getPathInHome(['helper']);
};
const getBinPath = function () {
    return path.join(getHelperPath(), 'bin');
};
const getGitConfigPath = function () {
    return path.join(getHelperPath(), 'git-config');
};
const getLegacyBinPath = function () {
    return path.join(getLegacyPathInHome(['helper', 'bin']));
};
const CONFIG_FILES = {
    bash: '.bashrc',
    zsh: '.zshrc',
    fish: '.config/fish/config.fish',
};
export const getShellInfo = function () {
    const shellEnv = process.env.SHELL;
    if (!shellEnv) {
        throw new Error('Unable to detect SHELL type, make sure the variable is defined in your environment');
    }
    const shell = shellEnv.split(path.sep).pop();
    return {
        shell,
        incFilePath: `${getHelperPath()}/path.${shell}.inc`,
        // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
        configFile: CONFIG_FILES[shell],
    };
};
const cleanupShell = async function () {
    try {
        const { configFile, incFilePath } = getShellInfo();
        if (configFile === undefined) {
            return;
        }
        await removeConfig(configFile, getInitContent(incFilePath));
    }
    catch { }
};
export const uninstall = async function () {
    await Promise.all([
        rm(getHelperPath(), { force: true, recursive: true }),
        removeConfig(GIT_CONFIG, getGitConfigContent(getGitConfigPath())),
        cleanupShell(),
    ]);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
const removeConfig = async function (name, toRemove) {
    const configPath = path.join(os.homedir(), name);
    if (!(await fileExistsAsync(configPath))) {
        return;
    }
    const content = await readFile(configPath, 'utf8');
    return await writeFile(configPath, content.replace(toRemove, ''));
};
