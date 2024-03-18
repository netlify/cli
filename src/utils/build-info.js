import fuzzy from 'fuzzy';
import inquirer from 'inquirer';
import { chalk, log } from './command-helpers.js';
/**
 * Filters the inquirer settings based on the input
 */
const filterSettings = function (scriptInquirerOptions, input) {
    const filterOptions = scriptInquirerOptions.map((scriptInquirerOption) => scriptInquirerOption.name);
    // TODO: remove once https://github.com/sindresorhus/eslint-plugin-unicorn/issues/1394 is fixed
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    const filteredSettings = fuzzy.filter(input, filterOptions);
    const filteredSettingNames = new Set(filteredSettings.map((filteredSetting) => (input ? filteredSetting.string : filteredSetting)));
    return scriptInquirerOptions.filter((t) => filteredSettingNames.has(t.name));
};
/**
 * Formats the settings to present it as an array for the inquirer input so that it can choose one
 */
const formatSettingsArrForInquirer = function (settings, type = 'dev') {
    return settings.map((setting) => {
        const cmd = type === 'dev' ? setting.devCommand : setting.buildCommand;
        return {
            name: `[${chalk.yellow(setting.framework.name)}] '${cmd}'`,
            value: { ...setting, commands: [cmd] },
            short: `${setting.name}-${cmd}`,
        };
    });
};
/**
 * Detects and filters the build setting for a project and a command
 */
export async function detectBuildSettings(command) {
    const { project, workspacePackage } = command;
    const buildSettings = await project.getBuildSettings(project.workspace ? workspacePackage : '');
    return buildSettings
        .filter((setting) => {
        if (project.workspace && project.relativeBaseDirectory && setting.packagePath) {
            return project.relativeBaseDirectory.startsWith(setting.packagePath);
        }
        return true;
    })
        .filter((setting) => setting.devCommand);
}
/**
 * Uses `@netlify/build-info` to detect the dev settings and port based on the framework
 * and the build system that is used.
 * @param command The base command
 * @param type The type of command (dev or build)
 */
export const detectFrameworkSettings = async (command, type = 'dev') => {
    const { relConfigFilePath } = command.netlify;
    const settings = await detectBuildSettings(command);
    if (settings.length === 1) {
        return settings[0];
    }
    if (settings.length > 1) {
        // multiple matching detectors, make the user choose
        const scriptInquirerOptions = formatSettingsArrForInquirer(settings, type);
        const { chosenSettings } = await inquirer.prompt({
            name: 'chosenSettings',
            message: `Multiple possible ${type} commands found`,
            // @ts-expect-error is not known by the types as it uses the autocomplete plugin
            type: 'autocomplete',
            source(_, input = '') {
                if (!input)
                    return scriptInquirerOptions;
                // only show filtered results
                return filterSettings(scriptInquirerOptions, input);
            },
        });
        log(`
Update your ${relConfigFilePath} to avoid this selection prompt next time:

[build]
command = "${chosenSettings.buildCommand}"
publish = "${chosenSettings.dist}"

[dev]
command = "${chosenSettings.devCommand}"
`);
        return chosenSettings;
    }
};
