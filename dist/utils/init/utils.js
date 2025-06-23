import { writeFile } from 'fs/promises';
import path from 'path';
import cleanDeep from 'clean-deep';
import inquirer from 'inquirer';
import { fileExistsAsync } from '../../lib/fs.js';
import { normalizeBackslash } from '../../lib/path.js';
import { detectBuildSettings } from '../build-info.js';
import { chalk, logAndThrowError, log, warn } from '../command-helpers.js';
import { getRecommendPlugins, getUIPlugins } from './plugins.js';
const formatTitle = (title) => chalk.cyan(title);
/**
 * Retrieve a list of plugins to auto install
 * @param pluginsToAlwaysInstall these plugins represent runtimes that are
 * expected to be "automatically" installed. Even though
 * they can be installed on package/toml, we always
 * want them installed in the site settings. When installed
 * there our build will automatically install the latest without
 * user management of the versioning.
 */
export const getPluginsToAutoInstall = (_command, pluginsInstalled = [], pluginsRecommended = []) => {
    const nextRuntime = '@netlify/plugin-nextjs';
    const pluginsToAlwaysInstall = new Set([nextRuntime]);
    return pluginsRecommended.reduce((acc, plugin) => pluginsInstalled.includes(plugin) && !pluginsToAlwaysInstall.has(plugin) ? acc : [...acc, plugin], []);
};
const normalizeSettings = (settings, config, command) => {
    const plugins = getPluginsToAutoInstall(command, settings.plugins_from_config_file, settings.plugins_recommended);
    const recommendedPlugins = getRecommendPlugins(plugins, config);
    return {
        defaultBaseDir: settings.baseDirectory ?? command.project.relativeBaseDirectory ?? '',
        defaultBuildCmd: config.build.command || settings.buildCommand,
        defaultBuildDir: settings.dist,
        defaultFunctionsDir: config.build.functions || 'netlify/functions',
        recommendedPlugins,
    };
};
const getPromptInputs = ({ defaultBaseDir, defaultBuildCmd, defaultBuildDir, }) => {
    const inputs = [
        defaultBaseDir !== '' && {
            type: 'input',
            name: 'baseDir',
            message: 'Base directory `(blank for current dir):',
            default: defaultBaseDir,
        },
        {
            type: 'input',
            name: 'buildCmd',
            message: 'Your build command (hugo build/yarn run build/etc):',
            filter: (val) => (val === '' ? '# no build command' : val),
            default: defaultBuildCmd,
        },
        {
            type: 'input',
            name: 'buildDir',
            message: 'Directory to deploy (blank for current dir):',
            default: defaultBuildDir,
        },
    ].filter(Boolean);
    return inputs.filter(Boolean);
};
export const getBuildSettings = async ({ command, config, }) => {
    const settings = await detectBuildSettings(command);
    const setting = settings.length > 0 ? settings[0] : {};
    const { defaultBaseDir, defaultBuildCmd, defaultBuildDir, defaultFunctionsDir, recommendedPlugins } = normalizeSettings(setting, config, command);
    if (recommendedPlugins.length !== 0 && setting.framework?.name) {
        log(`Configuring ${formatTitle(setting.framework.name)} runtime...`);
        log();
    }
    const { baseDir, buildCmd, buildDir } = await inquirer.prompt(getPromptInputs({
        defaultBaseDir,
        defaultBuildCmd,
        defaultBuildDir,
    }));
    const pluginsToInstall = recommendedPlugins.map((plugin) => ({ package: plugin }));
    const normalizedBaseDir = baseDir ? normalizeBackslash(baseDir) : undefined;
    return { baseDir: normalizedBaseDir, buildCmd, buildDir, functionsDir: defaultFunctionsDir, pluginsToInstall };
};
const getNetlifyToml = ({ command = '# no build command', functions = 'functions', publish = '.', }) => `# example netlify.toml
[build]
  command = "${command}"
  functions = "${functions}"
  publish = "${publish}"

  ## Uncomment to use this redirect for Single Page Applications like create-react-app.
  ## Not needed for static site generators.
  #[[redirects]]
  #  from = "/*"
  #  to = "/index.html"
  #  status = 200

  ## (optional) Settings for Netlify Dev
  ## https://github.com/netlify/cli/blob/main/docs/netlify-dev.md#project-detection
  #[dev]
  #  command = "yarn start" # Command to start your dev server
  #  port = 3000 # Port that the dev server will be listening on
  #  publish = "dist" # Folder with the static content for _redirect file

  ## more info on configuring this file: https://ntl.fyi/file-based-build-config
`;
export const saveNetlifyToml = async ({ baseDir, buildCmd, buildDir, config, configPath, functionsDir, repositoryRoot, }) => {
    const tomlPathParts = [repositoryRoot, baseDir, 'netlify.toml'].filter((part) => part != null && part.length > 0);
    const tomlPath = path.join(...tomlPathParts);
    if (await fileExistsAsync(tomlPath)) {
        return;
    }
    // We don't want to create a `netlify.toml` file that overrides existing configuration
    // In a monorepo the configuration can come from a repo level netlify.toml
    // so we make sure it doesn't by checking `configPath === undefined`
    // @ts-expect-error TS(2349)
    if (configPath === undefined && Object.keys(cleanDeep(config)).length !== 0) {
        return;
    }
    const { makeNetlifyTOML } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'makeNetlifyTOML',
            message: 'No netlify.toml detected. Would you like to create one with these build settings?',
            default: true,
        },
    ]);
    if (makeNetlifyTOML) {
        try {
            await writeFile(tomlPath, getNetlifyToml({ command: buildCmd, publish: buildDir, functions: functionsDir }), 'utf-8');
        }
        catch (error) {
            warn(`Failed saving Netlify toml file: ${error instanceof Error ? error.message : error?.toString()}`);
        }
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'error' implicitly has an 'any' ty... Remove this comment to see the full error message
export const formatErrorMessage = ({ error, message }) => {
    const errorMessage = error.json ? `${error.message} - ${JSON.stringify(error.json)}` : error.message;
    return `${message} with error: ${chalk.red(errorMessage)}`;
};
export const createDeployKey = async ({ api }) => {
    try {
        const deployKey = await api.createDeployKey();
        return deployKey;
    }
    catch (error) {
        const message = formatErrorMessage({ message: 'Failed creating deploy key', error });
        return logAndThrowError(message);
    }
};
export const updateSite = async ({ api, options, siteId, }) => {
    try {
        const updatedSite = await api.updateSite({ siteId, body: options });
        return updatedSite;
    }
    catch (error) {
        const message = formatErrorMessage({ message: 'Failed updating project with repo information', error });
        return logAndThrowError(message);
    }
};
export const setupSite = async ({ api, configPlugins, pluginsToInstall, repo, siteId, }) => {
    const updatedSite = await updateSite({
        siteId,
        api,
        // merge existing plugins with new ones
        // @ts-expect-error(serhalp) -- `plugins` is missing from `api.updateSite()` req body type
        options: { repo, plugins: [...getUIPlugins(configPlugins), ...pluginsToInstall] },
    });
    return updatedSite;
};
//# sourceMappingURL=utils.js.map